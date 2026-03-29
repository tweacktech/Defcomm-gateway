// resources/js/pages/meet/room.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Complete rewrite v3 — PATCHED (all 6 WebRTC bugs fixed)
//
// FIXES applied over v3:
//
// FIX 1 — buildPC: force startMedia() when neither mediaReady nor localStream
//          exists. Previously a joining peer could enter buildPC before media
//          was ever initialised, producing a PeerConnection with zero tracks
//          (= silence + black video on the remote side).
//
// FIX 2 — startScreen: if no video sender exists yet (camera was off when
//          screen share started), fall back to addTrack() instead of silently
//          skipping. onnegotiationneeded then fires the re-offer automatically.
//
// FIX 3 — buildPC: register pc.onnegotiationneeded so that addTrack() calls
//          (screen-share fallback, or any future track addition) automatically
//          trigger a re-offer without manual intervention.
//
// FIX 4 — VideoTile: explicit useEffect forces el.muted = false for remote
//          elements and calls el.play() after srcObject is set, defeating
//          browsers that silently ignore autoPlay on dynamically-assigned
//          streams.
//
// FIX 5 — WaitingOverlay: onResend prop is now wired to the real /join
//          endpoint from the render site instead of being left unwired.
//
// FIX 6 — handleOffer / handleAnswer: add a 500ms deferred flushIce() after
//          the immediate flush so ICE candidates that arrive during signaling
//          lag (common over WebSocket round-trips) are not permanently lost.
//
// Architecture notes (unchanged from v3):
// 1. GUEST SELF-DETECTION via peer_id only — never auth.user.id.
// 2. WAITING ROOM uses a separate waitEcho instance.
// 3. MEDIA BEFORE ECHO — startMedia() awaited before buildLiveEcho().
// 4. OFFER STRATEGY — new joiner offers; existing peers pre-warm PC only.
// 5. ICE BUFFERING — queue + flush after setRemoteDescription.
// 6. SCROLL — flex-1 min-h-0 grid with overflow-y-auto.
// 7. SCREEN LOCK — beforeunload + popstate guard.
// ─────────────────────────────────────────────────────────────────────────────

import { Head, usePage, router } from '@inertiajs/react';
import axios from 'axios';
import {
    Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
    PhoneOff, Hand, MessageSquare, Users, Copy, Check, Shield,
    ChevronLeft, Clock, X, LogOut, StopCircle, Monitor,
    Circle, Square, Download, UserX, UserCheck, Hourglass, AlertTriangle,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomConfig {
    id: number; uid: string; name: string; status: string;
    video_enabled: boolean; audio_enabled: boolean; chat_enabled: boolean;
    screen_share_enabled: boolean; recording_enabled: boolean;
    waiting_room: boolean; join_url: string;
}

interface PeerState {
    peer_id: string; display_name: string; role: string;
    video_on: boolean; audio_on: boolean; screen_sharing: boolean;
    hand_raised: boolean; speaking: boolean; stream?: MediaStream;
}

interface ChatMsg {
    id: string; peer_id: string; display_name: string; text: string; sent_at: string;
}

interface RecState {
    id: number | null; active: boolean; duration: number; downloadUrl: string | null;
}

type PageProps = {
    room: RoomConfig; peer_id: string; display_name: string;
    is_owner: boolean; is_guest: boolean;
    reverb_key: string; reverb_host: string; reverb_port: number;
    stun_servers: RTCIceServer[];
    auth?: { user: { id: number; name: string } };
};

type EndReason = 'left' | 'kicked' | 'room-ended';

// ─── HTTP ─────────────────────────────────────────────────────────────────────

const http = {
    post:  (url: string, data?: object) => axios.post(url, data ?? {}).then(r => r.data),
    patch: (url: string, data?: object) => axios.patch(url, data ?? {}).then(r => r.data),
    bin:   (url: string, buf: ArrayBuffer) =>
        axios.post(url, buf, { headers: { 'Content-Type': 'application/octet-stream' } })
             .then(r => r.data),
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const fmtDur = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function makeEcho(
    key: string, host: string, port: number, peer_id: string,
): Echo<any> {
    (window as any).Pusher = Pusher;
    return new Echo({
        broadcaster: 'reverb',
        key, wsHost: host, wsPort: port,
        forceTLS: false, enabledTransports: ['ws', 'wss'],
        authorizer: (channel: any) => ({
            authorize: (socketId: string, cb: Function) =>
                axios.post('/broadcasting/auth', {
                    socket_id: socketId, channel_name: channel.name, peer_id,
                }).then(r => cb(false, r.data)).catch(e => cb(true, e)),
        }),
    });
}

/** Attach a voice-activity detector to a stream. Returns a cleanup fn. */
function speakDetector(
    stream: MediaStream,
    onChange: (active: boolean) => void,
    threshold = 12,
): () => void {
    let ctx: AudioContext | null = null;
    let timer = 0;
    try {
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const an  = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        let was = false;
        const tick = () => {
            an.getByteFrequencyData(buf);
            const v = buf.reduce((a, b) => a + b, 0) / buf.length > threshold;
            if (v !== was) { was = v; onChange(v); }
            timer = window.setTimeout(tick, 100) as unknown as number;
        };
        tick();
    } catch { /* no AudioContext yet */ }
    return () => { clearTimeout(timer); ctx?.close().catch(() => {}); };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VideoTile({
    peer, local = false, pinned = false, onClick,
}: {
    peer: PeerState; local?: boolean; pinned?: boolean; onClick?: () => void;
}) {
    const vRef = useRef<HTMLVideoElement>(null);

    // FIX 4a — assign srcObject
    useEffect(() => {
        const el = vRef.current;
        if (!el) return;
        const src = (peer.video_on && peer.stream) ? peer.stream : null;
        if (el.srcObject !== src) el.srcObject = src;
    }, [peer.stream, peer.video_on]);

    // FIX 4b — force remote elements unmuted and trigger play.
    // Some browsers persist the muted attribute or silently suppress autoPlay
    // when srcObject is assigned programmatically after mount.
    useEffect(() => {
        const el = vRef.current;
        if (!el || local) return;
        el.muted = false;
        if (peer.stream && peer.video_on) {
            el.play().catch(() => {/* autoplay policy — user gesture needed */});
        }
    }, [peer.stream, peer.video_on, local]);

    const initial = peer.display_name[0]?.toUpperCase() ?? '?';
    const ring = peer.speaking
        ? 'ring-2 ring-green-400/80 shadow-green-900/30 shadow-lg'
        : pinned ? 'ring-2 ring-primary/50' : '';

    return (
        <div onClick={onClick}
            className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900 transition-all duration-150 ${ring} ${onClick ? 'cursor-pointer' : ''}`}>
            <video ref={vRef} autoPlay muted={local} playsInline
                className={`h-full w-full object-cover ${peer.video_on && peer.stream ? '' : 'hidden'}`} />
            {(!peer.video_on || !peer.stream) && (
                <div className="flex flex-col items-center gap-2 p-2">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white transition-colors ${peer.speaking ? 'bg-green-600' : 'bg-zinc-700'}`}>
                        {initial}
                    </div>
                    <span className="max-w-[8rem] truncate text-xs text-zinc-400">{peer.display_name}</span>
                </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-xs text-white">
                {peer.speaking && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-400" />}
                {!peer.audio_on && <MicOff className="h-3 w-3 shrink-0 text-red-400" />}
                {peer.hand_raised && <Hand className="h-3 w-3 shrink-0 text-yellow-400" />}
                {peer.screen_sharing && <Monitor className="h-3 w-3 shrink-0 text-blue-400" />}
                <span className="min-w-0 flex-1 truncate font-medium drop-shadow">
                    {local ? `${peer.display_name} (You)` : peer.display_name}
                </span>
                {peer.role === 'host' && <Shield className="h-3 w-3 shrink-0 text-primary" />}
            </div>
        </div>
    );
}

function ScreenView({
    stream, owner, isLocal, onStop,
}: { stream: MediaStream; owner: string; isLocal: boolean; onStop?: () => void }) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
    return (
        <div className="relative h-full w-full overflow-hidden rounded-xl bg-black ring-2 ring-blue-500/30">
            <video ref={ref} autoPlay muted={isLocal} playsInline className="h-full w-full object-contain" />
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-blue-700/90 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                <Monitor className="h-3.5 w-3.5" />
                {isLocal ? 'You are sharing' : `${owner}'s screen`}
            </div>
            {isLocal && onStop && (
                <button onClick={onStop}
                    className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600">
                    <StopCircle className="h-3.5 w-3.5" /> Stop sharing
                </button>
            )}
        </div>
    );
}

// FIX 5 — onResend is required (not optional). The call site must wire it
// to the real API — see the render section below.
function WaitingOverlay({
    name, onResend,
}: { name: string; onResend: () => Promise<void> }) {
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

    const handleResend = async () => {
        setStatus('sending');
        await onResend();
        setStatus('sent');
        setTimeout(() => setStatus('idle'), 3000);
    };

    return (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-zinc-950/95 backdrop-blur-sm">
            <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/10" />
                <div className="flex h-full w-full items-center justify-center rounded-full bg-yellow-500/15">
                    <Hourglass className="h-8 w-8 animate-pulse text-yellow-400" />
                </div>
            </div>
            <div className="text-center">
                <p className="text-2xl font-bold text-white">Waiting to be admitted</p>
                <p className="mt-2 text-sm text-zinc-400">
                    The host will let you into <span className="font-semibold text-white">{name}</span> shortly
                </p>
            </div>
            <p className="rounded-full border border-zinc-800 px-4 py-1.5 text-xs text-zinc-500">
                Camera and microphone are paused while you wait
            </p>
            <button
                onClick={handleResend}
                disabled={status !== 'idle'}
                className={[
                    'flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all duration-200',
                    status === 'sent'
                        ? 'border-green-500/40 bg-green-500/10 text-green-400 cursor-default'
                        : status === 'sending'
                        ? 'border-zinc-700 bg-zinc-800/50 text-zinc-500 cursor-wait'
                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white',
                ].join(' ')}
            >
                {status === 'sent' ? (
                    <><Check className="h-4 w-4 text-green-400" /> Request sent</>
                ) : status === 'sending' ? (
                    <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" /> Sending…</>
                ) : (
                    <><UserCheck className="h-4 w-4" /> Resend admission request</>
                )}
            </button>
        </div>
    );
}

function AdmitPanel({
    list, onAdmit, onDeny,
}: { list: PeerState[]; onAdmit: (id: string) => void; onDeny: (id: string) => void }) {
    if (!list.length) return null;
    return (
        <div className="absolute left-1/2 top-16 z-30 w-80 -translate-x-1/2 rounded-2xl border border-yellow-500/25 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-yellow-400">
                <Hourglass className="h-3.5 w-3.5" />
                {list.length} waiting to join
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
                {list.map(p => (
                    <div key={p.peer_id} className="flex items-center gap-3 rounded-xl bg-zinc-800 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
                            {p.display_name[0]?.toUpperCase()}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{p.display_name}</span>
                        <button onClick={() => onAdmit(p.peer_id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600/20 text-green-400 transition hover:bg-green-600 hover:text-white">
                            <UserCheck className="h-4 w-4" />
                        </button>
                        <button onClick={() => onDeny(p.peer_id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600/20 text-red-400 transition hover:bg-red-600 hover:text-white">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Dialog({ children }: { children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-700/60 bg-zinc-900 p-6 text-center shadow-2xl">
                {children}
            </div>
        </div>
    );
}

function HostLeaveDialog({
    onEndAll, onLeaveOnly, onCancel,
}: { onEndAll: () => void; onLeaveOnly: () => void; onCancel: () => void }) {
    return (
        <Dialog>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                <PhoneOff className="h-6 w-6 text-red-400" />
            </div>
            <h2 className="mb-1 text-lg font-bold text-white">Leave Meeting?</h2>
            <p className="mb-6 text-sm text-zinc-400">
                End for everyone or leave and let others continue.
            </p>
            <div className="space-y-2">
                <Button onClick={onEndAll} className="w-full gap-2 bg-red-600 hover:bg-red-500">
                    <StopCircle className="h-4 w-4" /> End for Everyone
                </Button>
                <Button onClick={onLeaveOnly} variant="outline"
                    className="w-full gap-2 border-zinc-600 text-zinc-200 hover:bg-zinc-800">
                    <LogOut className="h-4 w-4" /> Leave — Let Others Continue
                </Button>
                <button onClick={onCancel} className="w-full py-2 text-sm text-zinc-500 transition hover:text-zinc-300">
                    Stay in Meeting
                </button>
            </div>
        </Dialog>
    );
}

function GuardDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-yellow-500/25 bg-zinc-900 p-6 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-yellow-500/10">
                    <AlertTriangle className="h-6 w-6 text-yellow-400" />
                </div>
                <h2 className="mb-1 text-lg font-bold text-white">Leave the Meeting?</h2>
                <p className="mb-1 text-sm text-zinc-400">Navigating away will disconnect you from the call.</p>
                <p className="mb-6 text-xs text-zinc-600">Recording and background services will stop.</p>
                <div className="space-y-2">
                    <Button onClick={onStay} className="w-full bg-primary hover:bg-primary/90">
                        Stay in Meeting
                    </Button>
                    <button onClick={onLeave} className="w-full py-2 text-sm text-zinc-500 transition hover:text-red-400">
                        Leave Anyway
                    </button>
                </div>
            </div>
        </div>
    );
}

function EndScreen({ name, reason }: { name: string; reason: EndReason }) {
    const map = {
        left:         { icon: '👋', title: 'You left the meeting',   sub: 'The call has ended on your side.' },
        kicked:       { icon: '🚫', title: 'You were removed',       sub: 'The host ended your session.' },
        'room-ended': { icon: '📴', title: 'Meeting ended',          sub: 'The host ended the meeting for everyone.' },
    };
    const { icon, title, sub } = map[reason];
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-950 text-white">
            <span className="text-6xl">{icon}</span>
            <div className="text-center">
                <p className="text-xl font-bold">{title}</p>
                <p className="mt-1 text-sm text-zinc-400">{sub}</p>
                <p className="mt-0.5 text-xs text-zinc-600">{name}</p>
            </div>
            <a href="/" className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800">
                Go Home
            </a>
        </div>
    );
}

function RecBadge({ duration }: { duration: number }) {
    return (
        <div className="flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-1 text-xs font-medium text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            REC {fmtDur(duration)}
        </div>
    );
}

function Btn({
    on, red, blue, yellow, wide, onClick, title, children,
}: {
    on?: boolean; red?: boolean; blue?: boolean; yellow?: boolean; wide?: boolean;
    onClick: () => void; title: string; children: React.ReactNode;
}) {
    const base = 'flex items-center justify-center rounded-full transition-all duration-150';
    const size = wide ? 'h-11 w-14' : 'h-11 w-11';
    const col  = red    ? 'bg-red-600 hover:bg-red-500'
               : blue   ? on ? 'bg-blue-600 ring-2 ring-blue-400/30 hover:bg-blue-500' : 'bg-zinc-700 hover:bg-zinc-600'
               : yellow ? on ? 'bg-yellow-500 ring-2 ring-yellow-400/30 hover:bg-yellow-400' : 'bg-zinc-700 hover:bg-zinc-600'
               : on     ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-500';
    return (
        <button onClick={onClick} title={title} className={`${base} ${size} ${col}`}>
            {children}
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MeetRoom() {
    const {
        room, peer_id, display_name, is_owner, is_guest,
        reverb_key, reverb_host, reverb_port, stun_servers,
    } = usePage<PageProps>().props;

    const defVideo = is_owner && room.video_enabled;
    const defAudio = is_owner && room.audio_enabled;

    // ── UI state ──────────────────────────────────────────────────────────────
    const [peers,        setPeers]        = useState<Map<string, PeerState>>(new Map());
    const [waiting,      setWaiting]      = useState<PeerState[]>([]);
    const [admitted,     setAdmitted]     = useState(!room.waiting_room || is_owner);
    const [videoOn,      setVideoOn]      = useState(defVideo);
    const [audioOn,      setAudioOn]      = useState(defAudio);
    const [handRaised,   setHandRaised]   = useState(false);
    const [localSpeak,   setLocalSpeak]   = useState(false);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [chatOpen,     setChatOpen]     = useState(false);
    const [panelOpen,    setPanelOpen]    = useState(false);
    const [pinnedId,     setPinnedId]     = useState<string | null>(null);
    const [urlCopied,    setUrlCopied]    = useState(false);
    const [hostDialog,   setHostDialog]   = useState(false);
    const [guardDialog,  setGuardDialog]  = useState(false);
    const [endReason,    setEndReason]    = useState<EndReason | null>(null);
    const [msgs,         setMsgs]         = useState<ChatMsg[]>([]);
    const [chatInput,    setChatInput]    = useState('');
    const [rec,          setRec]          = useState<RecState>({
        id: null, active: false, duration: 0, downloadUrl: null,
    });

    // ── Mutable refs ──────────────────────────────────────────────────────────
    const R = useRef({
        localStream:  null as MediaStream | null,
        screenStream: null as MediaStream | null,
        videoOn:      defVideo,
        audioOn:      defAudio,
        handRaised:   false,
        pcs:          new Map<string, RTCPeerConnection>(),
        iceBuf:       new Map<string, RTCIceCandidate[]>(),
        liveEcho:     null as Echo<any> | null,
        waitEcho:     null as Echo<any> | null,
        channel:      null as any,
        socketId:     null as string | null,
        mediaRec:     null as MediaRecorder | null,
        recTimer:     null as ReturnType<typeof setInterval> | null,
        recId:        null as number | null,
        speak:        new Map<string, () => void>(),
        seenMsgs:     new Set<string>(),
        inMeeting:    true,
        pendingNav:   null as (() => void) | null,
        mediaReady:   null as Promise<MediaStream> | null,
        mediaResolve: null as ((s: MediaStream) => void) | null,
    });

    const chatEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

    useEffect(() => { R.current.videoOn      = videoOn;      }, [videoOn]);
    useEffect(() => { R.current.audioOn      = audioOn;      }, [audioOn]);
    useEffect(() => { R.current.handRaised   = handRaised;   }, [handRaised]);
    useEffect(() => { R.current.screenStream = screenStream; }, [screenStream]);

    // ── Screen lock ───────────────────────────────────────────────────────────

    useEffect(() => {
        const onUnload = (e: BeforeUnloadEvent) => {
            if (!R.current.inMeeting) return;
            e.preventDefault();
            e.returnValue = 'You are in a meeting. Are you sure you want to leave?';
        };
        const onPop = () => {
            if (!R.current.inMeeting) return;
            window.history.pushState(null, '', window.location.href);
            R.current.pendingNav = () => window.history.back();
            setGuardDialog(true);
        };
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('beforeunload', onUnload);
        window.addEventListener('popstate', onPop);
        return () => {
            window.removeEventListener('beforeunload', onUnload);
            window.removeEventListener('popstate', onPop);
        };
    }, []);

    // ── Media ─────────────────────────────────────────────────────────────────

    const startMedia = useCallback(async (): Promise<MediaStream | null> => {
        if (!R.current.mediaReady) {
            R.current.mediaReady = new Promise(res => { R.current.mediaResolve = res; });
        }
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: room.video_enabled,
                audio: room.audio_enabled,
            });
            s.getVideoTracks().forEach(t => { t.enabled = defVideo; });
            s.getAudioTracks().forEach(t => { t.enabled = defAudio; });
            R.current.localStream = s;
            R.current.mediaResolve?.(s);
            if (room.audio_enabled) {
                R.current.speak.get('__local')?.();
                R.current.speak.set('__local', speakDetector(s, v => setLocalSpeak(v)));
            }
            return s;
        } catch {
            setVideoOn(false);
            return null;
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const stopMedia = useCallback(() => {
        R.current.localStream?.getTracks().forEach(t => t.stop());
        R.current.screenStream?.getTracks().forEach(t => t.stop());
    }, []);

    // ── WebRTC helpers ────────────────────────────────────────────────────────

    const attachSpeak = useCallback((pid: string, stream: MediaStream) => {
        R.current.speak.get(pid)?.();
        R.current.speak.set(pid, speakDetector(stream, v =>
            setPeers(prev => {
                const m = new Map(prev), p = m.get(pid);
                if (p) m.set(pid, { ...p, speaking: v });
                return m;
            })
        ));
    }, []);

    const flushIce = useCallback(async (pid: string, pc: RTCPeerConnection) => {
        const buf = R.current.iceBuf.get(pid) ?? [];
        R.current.iceBuf.delete(pid);
        for (const c of buf) await pc.addIceCandidate(c).catch(() => {});
    }, []);

    const removePeer = useCallback((pid: string) => {
        R.current.speak.get(pid)?.(); R.current.speak.delete(pid);
        R.current.iceBuf.delete(pid);
        R.current.pcs.get(pid)?.close(); R.current.pcs.delete(pid);
        setPeers(prev => { const m = new Map(prev); m.delete(pid); return m; });
    }, []);

    const buildPC = useCallback(async (remotePeerId: string): Promise<RTCPeerConnection> => {
        // Tear down zombie
        const old = R.current.pcs.get(remotePeerId);
        if (old) { old.close(); R.current.pcs.delete(remotePeerId); }

        const pc = new RTCPeerConnection({ iceServers: stun_servers });

        // ── FIX 1 — guarantee tracks are added ────────────────────────────────
        // If neither mediaReady nor localStream exists yet, force-start media
        // before adding tracks. This covers the case where buildPC() is called
        // (from ch.joining pre-warm, or from handleOffer) before the component's
        // mount async block has called startMedia().
        if (!R.current.localStream && !R.current.mediaReady) {
            await startMedia();
        }
        const stream = R.current.localStream
            ?? (R.current.mediaReady ? await R.current.mediaReady : null);
        if (stream) {
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
        }

        // ICE trickle
        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;
            http.post(`/meet/${room.uid}/signal`, {
                to: remotePeerId, type: 'ice-candidate',
                payload: candidate, from_peer_id: peer_id,
            }).catch(() => {});
        };

        // Incoming remote track → wire to peer state
        pc.ontrack = ({ streams }) => {
            const remote = streams[0];
            if (!remote) return;
            attachSpeak(remotePeerId, remote);
            setPeers(prev => {
                const m = new Map(prev), p = m.get(remotePeerId);
                if (p) m.set(remotePeerId, { ...p, stream: remote });
                return m;
            });
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed') pc.restartIce();
        };

        // ── FIX 3 — renegotiation handler ─────────────────────────────────────
        // Fires automatically when addTrack() is called after the initial
        // negotiation (e.g. screen-share fallback path in startScreen).
        // Guard with signalingState === 'stable' to avoid re-entrant offers.
        pc.onnegotiationneeded = async () => {
            if (pc.signalingState !== 'stable') return;
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await http.post(`/meet/${room.uid}/signal`, {
                    to: remotePeerId, type: 'offer',
                    payload: pc.localDescription, from_peer_id: peer_id,
                });
            } catch (e) {
                console.warn('[RTC] renegotiation failed', e);
            }
        };

        R.current.pcs.set(remotePeerId, pc);
        return pc;
    }, [stun_servers, room.uid, peer_id, attachSpeak, startMedia]);

    const sendOffer = useCallback(async (remotePeerId: string) => {
        const pc = await buildPC(remotePeerId);
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await http.post(`/meet/${room.uid}/signal`, {
                to: remotePeerId, type: 'offer',
                payload: pc.localDescription, from_peer_id: peer_id,
            });
        } catch (e) {
            console.warn('[RTC] sendOffer →', remotePeerId, e);
        }
    }, [buildPC, room.uid, peer_id]);

    const handleOffer = useCallback(async (
        from: string, payload: RTCSessionDescriptionInit,
    ) => {
        const pc = await buildPC(from);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            await flushIce(from, pc);
            // FIX 6a — deferred retry for ICE candidates that arrive during
            // the WebSocket round-trip between setRemoteDescription and the
            // remote peer's ICE gathering completing.
            setTimeout(() => flushIce(from, pc), 500);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await http.post(`/meet/${room.uid}/signal`, {
                to: from, type: 'answer',
                payload: pc.localDescription, from_peer_id: peer_id,
            });
        } catch (e) {
            console.warn('[RTC] handleOffer ←', from, e);
        }
    }, [buildPC, flushIce, room.uid, peer_id]);

    const handleAnswer = useCallback(async (
        from: string, payload: RTCSessionDescriptionInit,
    ) => {
        const pc = R.current.pcs.get(from);
        if (!pc || pc.signalingState !== 'have-local-offer') return;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            await flushIce(from, pc);
            // FIX 6b — same deferred retry on the answer path.
            setTimeout(() => flushIce(from, pc), 500);
        } catch (e) {
            console.warn('[RTC] handleAnswer ←', from, e);
        }
    }, [flushIce]);

    const handleIce = useCallback(async (
        from: string, payload: RTCIceCandidateInit,
    ) => {
        const pc   = R.current.pcs.get(from);
        const cand = new RTCIceCandidate(payload);
        if (!pc?.remoteDescription) {
            const buf = R.current.iceBuf.get(from) ?? [];
            buf.push(cand);
            R.current.iceBuf.set(from, buf);
            return;
        }
        await pc.addIceCandidate(cand).catch(() => {});
    }, []);

    // ── Broadcast local media state ───────────────────────────────────────────

    const broadcastMedia = useCallback((
        overrides: Partial<Record<'video_on'|'audio_on'|'screen_sharing'|'hand_raised', boolean>> = {},
    ) => {
        http.post(`/meet/${room.uid}/media-state`, {
            peer_id,
            video_on:       R.current.videoOn,
            audio_on:       R.current.audioOn,
            screen_sharing: !!R.current.screenStream,
            hand_raised:    R.current.handRaised,
            ...overrides,
        }).catch(() => {});
    }, [room.uid, peer_id]);

    // ── Full teardown ─────────────────────────────────────────────────────────

    const teardown = useCallback(() => {
        R.current.inMeeting = false;
        stopMedia();
        R.current.mediaRec?.stop();
        if (R.current.recTimer) clearInterval(R.current.recTimer);
        R.current.speak.forEach(fn => fn());
        R.current.pcs.forEach(pc => pc.close());
        R.current.pcs.clear();
        R.current.liveEcho?.leave(`meet.${room.uid}`);
        R.current.waitEcho?.leave(`meet.${room.uid}`);
    }, [stopMedia, room.uid]);

    // ── Live call channel ─────────────────────────────────────────────────────

    const buildLiveEcho = useCallback(() => {
        if (R.current.liveEcho) return;

        const echo = makeEcho(reverb_key, reverb_host, reverb_port, peer_id);
        R.current.liveEcho = echo;

        const ch = echo.join(`meet.${room.uid}`);
        R.current.channel = ch;

        echo.connector.pusher.connection.bind('connected', () => {
            R.current.socketId = echo.connector.pusher.connection.socket_id;
        });
        const sid = (echo.connector as any).pusher?.connection?.socket_id;
        if (sid) R.current.socketId = sid;

        ch.here((members: any[]) => {
            const initial = new Map<string, PeerState>();

            members.forEach(m => {
                const byPeerId   = m.peer_id && m.peer_id === peer_id;
                const bySocketId = R.current.socketId && m.id === R.current.socketId;
                if (byPeerId || bySocketId) return;
                if (!m.peer_id) return;

                initial.set(m.peer_id, {
                    peer_id:        m.peer_id,
                    display_name:   m.display_name ?? m.name ?? 'Unknown',
                    role:           m.role ?? 'participant',
                    video_on:       false, audio_on: false,
                    screen_sharing: false, hand_raised: false, speaking: false,
                });
            });

            setPeers(initial);

            setTimeout(() => {
                initial.forEach((_, remotePeerId) => sendOffer(remotePeerId));
            }, 300);
        });

        ch.joining((member: any) => {
            if (!member.peer_id || member.peer_id === peer_id) return;
            buildPC(member.peer_id).catch(() => {});
            setPeers(prev => {
                if (prev.has(member.peer_id)) return prev;
                const m = new Map(prev);
                m.set(member.peer_id, {
                    peer_id:        member.peer_id,
                    display_name:   member.display_name ?? member.name ?? 'Unknown',
                    role:           'participant',
                    video_on:       false, audio_on: false,
                    screen_sharing: false, hand_raised: false, speaking: false,
                });
                return m;
            });
        });

        ch.leaving((member: any) => removePeer(member.peer_id));

        ch.listen('.meet.signal', async (data: any) => {
            if (data.to !== peer_id) return;
            if (data.type === 'offer')              await handleOffer(data.from, data.payload);
            else if (data.type === 'answer')        await handleAnswer(data.from, data.payload);
            else if (data.type === 'ice-candidate') await handleIce(data.from, data.payload);
        });

        ch.listen('.meet.participant-joined', (data: any) => {
            if (data.peer_id === peer_id) return;
            setWaiting(wp => wp.filter(p => p.peer_id !== data.peer_id));
            setPeers(prev => {
                const m = new Map(prev), ex = m.get(data.peer_id);
                m.set(data.peer_id, {
                    ...(ex ?? { stream: undefined, speaking: false }),
                    peer_id:        data.peer_id,
                    display_name:   data.display_name,
                    role:           data.role ?? 'participant',
                    video_on:       data.video_on ?? false,
                    audio_on:       data.audio_on ?? false,
                    screen_sharing: ex?.screen_sharing ?? false,
                    hand_raised:    ex?.hand_raised ?? false,
                });
                return m;
            });
        });

        ch.listen('.meet.participant-left',    (data: any) => removePeer(data.peer_id));

        ch.listen('.meet.participant-waiting', (data: any) => {
            if (!is_owner) return;
            setWaiting(wp => {
                if (wp.some(p => p.peer_id === data.peer_id)) return wp;
                return [...wp, {
                    peer_id: data.peer_id, display_name: data.display_name,
                    role: 'participant', video_on: false, audio_on: false,
                    screen_sharing: false, hand_raised: false, speaking: false,
                }];
            });
        });

        ch.listen('.meet.media-updated', (data: any) => {
            if (data.peer_id === peer_id) return;
            setPeers(prev => {
                const m = new Map(prev), p = m.get(data.peer_id);
                if (!p) return prev;
                m.set(data.peer_id, {
                    ...p,
                    video_on:       data.video_on,
                    audio_on:       data.audio_on,
                    screen_sharing: data.screen_sharing,
                    hand_raised:    data.hand_raised,
                });
                return m;
            });
        });

        ch.listen('.meet.room-ended', () => { teardown(); setEndReason('room-ended'); });

        ch.listen('.meet.participant-kicked', (data: any) => {
            if (data.peer_id === peer_id) { teardown(); setEndReason('kicked'); }
            else removePeer(data.peer_id);
        });

        ch.listen('.meet.recording-started', (data: any) =>
            setRec(r => ({ ...r, active: true, id: data.recording_id, duration: 0 })));
        ch.listen('.meet.recording-stopped', () =>
            setRec(r => ({ ...r, active: false })));

        ch.listenForWhisper('chat', (data: ChatMsg) => {
            if (R.current.seenMsgs.has(data.id)) return;
            R.current.seenMsgs.add(data.id);
            setMsgs(ms => [...ms, data]);
        });
    }, [
        room.uid, peer_id, is_owner, reverb_key, reverb_host, reverb_port,
        sendOffer, buildPC, handleOffer, handleAnswer, handleIce, removePeer, teardown,
    ]);

    // ── Waiting-room channel ──────────────────────────────────────────────────

    const buildWaitEcho = useCallback(() => {
        if (R.current.waitEcho) return;

        const echo = makeEcho(reverb_key, reverb_host, reverb_port, peer_id);
        R.current.waitEcho = echo;

        const ch = echo.join(`meet.${room.uid}`);

        ch.listen('.meet.participant-joined', async (data: any) => {
            if (data.peer_id !== peer_id) return;

            echo.leave(`meet.${room.uid}`);
            R.current.waitEcho = null;

            setAdmitted(true);
            await startMedia();
            buildLiveEcho();
        });

        ch.listen('.meet.room-ended', () => {
            teardown(); setEndReason('room-ended');
        });
    }, [room.uid, peer_id, reverb_key, reverb_host, reverb_port,
        startMedia, buildLiveEcho, teardown]);

    // ── Mount ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        (async () => {
            const resp = await http.post(`/meet/${room.uid}/join`, {
                peer_id, display_name,
                video_on: defVideo, audio_on: defAudio,
            }).catch(() => ({ admitted: true }));

            if (resp?.admitted === false) {
                setAdmitted(false);
                buildWaitEcho();
            } else {
                await startMedia();
                buildLiveEcho();
            }
        })();

        return () => { R.current.inMeeting = false; teardown(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Controls ──────────────────────────────────────────────────────────────

    const toggleAudio = () => {
        const next = !audioOn;
        R.current.localStream?.getAudioTracks().forEach(t => { t.enabled = next; });
        setAudioOn(next);
        broadcastMedia({ audio_on: next });
    };

    const toggleVideo = () => {
        const next = !videoOn;
        R.current.localStream?.getVideoTracks().forEach(t => { t.enabled = next; });
        setVideoOn(next);
        broadcastMedia({ video_on: next });
    };

    const toggleHand = () => {
        const next = !handRaised;
        setHandRaised(next);
        broadcastMedia({ hand_raised: next });
    };

    // ── FIX 2 — screen share with sender fallback ─────────────────────────────
    // If camera was off when screen share starts there will be no video sender.
    // In that case we addTrack() instead, which triggers onnegotiationneeded
    // (FIX 3) to re-offer automatically.
    const startScreen = async () => {
        try {
            const ss    = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const track = ss.getVideoTracks()[0];
            R.current.screenStream = ss;
            setScreenStream(ss);

            R.current.pcs.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    // replaceTrack is codec-stable — no renegotiation needed
                    sender.replaceTrack(track);
                } else {
                    // No video sender yet — addTrack fires onnegotiationneeded
                    pc.addTrack(track, ss);
                }
            });

            track.onended = stopScreen;
            broadcastMedia({ screen_sharing: true });
        } catch { /* user cancelled */ }
    };

    const stopScreen = useCallback(() => {
        R.current.screenStream?.getTracks().forEach(t => t.stop());
        R.current.screenStream = null;
        setScreenStream(null);
        const cam = R.current.localStream?.getVideoTracks()[0];
        if (cam) {
            R.current.pcs.forEach(pc => {
                pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(cam);
            });
        }
        broadcastMedia({ screen_sharing: false });
    }, [broadcastMedia]);

    const admitPeer = async (id: string) => {
        await http.patch(`/meet/${room.uid}/admit/${id}`).catch(() => {});
        setWaiting(wp => wp.filter(p => p.peer_id !== id));
    };

    const denyPeer = async (id: string) => {
        await http.patch(`/meet/${room.uid}/kick/${id}`).catch(() => {});
        setWaiting(wp => wp.filter(p => p.peer_id !== id));
    };

    // ── Recording ─────────────────────────────────────────────────────────────

    const startRec = async () => {
        if (!room.recording_enabled || !is_owner) return;
        try {
            const data = await http.post(`/meet/${room.uid}/recording/start`);
            if (!data?.recording_id) return;
            R.current.recId = data.recording_id;
            const tracks: MediaStreamTrack[] = [];
            R.current.localStream?.getTracks().forEach(t => tracks.push(t));
            R.current.screenStream?.getTracks().forEach(t => tracks.push(t));
            const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus' : 'video/webm';
            const mr = new MediaRecorder(new MediaStream(tracks), { mimeType: mime });
            R.current.mediaRec = mr;
            mr.ondataavailable = async e => {
                if (!e.data.size || !R.current.recId) return;
                http.bin(`/meet/${room.uid}/recording/${R.current.recId}/chunk`,
                    await e.data.arrayBuffer()).catch(() => {});
            };
            mr.start(5000);
            setRec({ id: data.recording_id, active: true, duration: 0, downloadUrl: null });
            R.current.recTimer = setInterval(() =>
                setRec(r => ({ ...r, duration: r.duration + 1 })), 1000);
        } catch (e) { console.error('Recording start failed', e); }
    };

    const stopRec = async () => {
        R.current.mediaRec?.stop();
        if (R.current.recTimer) { clearInterval(R.current.recTimer); R.current.recTimer = null; }
        const id = R.current.recId; if (!id) return; R.current.recId = null;
        try {
            const data = await http.post(`/meet/${room.uid}/recording/${id}/stop`);
            setRec(r => ({ ...r, active: false, downloadUrl: data.download_url ?? null }));
        } catch { setRec(r => ({ ...r, active: false })); }
    };

    // ── Leave / End ───────────────────────────────────────────────────────────

    const leaveRoom = useCallback(async () => {
        R.current.inMeeting = false;
        await http.post(`/meet/${room.uid}/leave`, { peer_id }).catch(() => {});
        teardown();
        if (is_guest) setEndReason('left');
        else router.get('/meet');
    }, [room.uid, peer_id, is_guest, teardown]);

    const endForAll = useCallback(async () => {
        R.current.inMeeting = false;
        if (rec.active) await stopRec();
        await http.patch(`/meet/${room.uid}/end`).catch(() => {});
        teardown();
        if (is_guest) setEndReason('left');
        else router.get('/meet');
    }, [room.uid, rec.active, is_guest, teardown]); // eslint-disable-line react-hooks/exhaustive-deps

    const doNav = () => {
        setGuardDialog(false);
        R.current.inMeeting = false;
        const f = R.current.pendingNav; R.current.pendingNav = null;
        if (f) f(); else leaveRoom();
    };

    // ── FIX 5 — WaitingOverlay resend handler wired to real API ───────────────
    const handleResendAdmission = useCallback(async () => {
        await http.post(`/meet/${room.uid}/join`, {
            peer_id, display_name,
            video_on: false, audio_on: false,
        }).catch(() => {});
    }, [room.uid, peer_id, display_name]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (endReason) return <EndScreen name={display_name} reason={endReason} />;

    const allPeers    = Array.from(peers.values());
    const total       = allPeers.length + 1;
    const sharingPeer = allPeers.find(p => p.screen_sharing && p.stream);
    const anySharing  = !!screenStream || !!sharingPeer;

    const gridCols = anySharing
        ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'
        : total <= 1  ? 'grid-cols-1'
        : total <= 4  ? 'grid-cols-2'
        : total <= 9  ? 'grid-cols-3'
        : total <= 16 ? 'grid-cols-4'
        : 'grid-cols-5';

    const localPeer: PeerState = {
        peer_id, display_name,
        role:           is_owner ? 'host' : 'participant',
        video_on:       videoOn,
        audio_on:       audioOn,
        screen_sharing: !!screenStream,
        hand_raised:    handRaised,
        speaking:       localSpeak,
        stream:         R.current.localStream ?? undefined,
    };

    return (
        <div className="relative flex h-screen flex-col bg-zinc-950 text-white">
            <Head title={room.name} />

            {guardDialog && (
                <GuardDialog onStay={() => { setGuardDialog(false); R.current.pendingNav = null; }} onLeave={doNav} />
            )}

            {/* FIX 5 — onResend is now wired to the real join endpoint */}
            {!admitted && (
                <WaitingOverlay
                    name={room.name}
                    onResend={handleResendAdmission}
                />
            )}

            {is_owner && room.waiting_room && (
                <AdmitPanel list={waiting} onAdmit={admitPeer} onDeny={denyPeer} />
            )}
            {hostDialog && (
                <HostLeaveDialog
                    onEndAll={() => { setHostDialog(false); endForAll(); }}
                    onLeaveOnly={() => { setHostDialog(false); leaveRoom(); }}
                    onCancel={() => setHostDialog(false)}
                />
            )}

            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950 px-4 py-2.5">
                <div className="flex items-center gap-3">
                    {!is_guest && (
                        <button
                            onClick={() => {
                                R.current.pendingNav = () => router.get('/meet');
                                setGuardDialog(true);
                            }}
                            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    )}
                    <div>
                        <p className="text-sm font-semibold leading-none">{room.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {total} participant{total !== 1 ? 's' : ''}
                            </span>
                            {waiting.length > 0 && (
                                <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-medium text-yellow-400">
                                    {waiting.length} waiting
                                </span>
                            )}
                            {is_guest && (
                                <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px]">Guest</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {rec.active && <RecBadge duration={rec.duration} />}
                    {!rec.active && rec.downloadUrl && is_owner && (
                        <a href={rec.downloadUrl}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800">
                            <Download className="h-3.5 w-3.5" /> Recording
                        </a>
                    )}
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(room.join_url);
                            setUrlCopied(true);
                            setTimeout(() => setUrlCopied(false), 2000);
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs transition hover:bg-zinc-800"
                    >
                        {urlCopied
                            ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied!</>
                            : <><Copy className="h-3.5 w-3.5" /> Invite</>}
                    </button>
                    <div className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-2.5 py-1.5 text-xs text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                        Live
                    </div>
                </div>
            </header>

            {/* Body */}
            <div className="flex min-h-0 flex-1 gap-2 p-2.5">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">

                    {anySharing && (
                        <div className="min-h-0 flex-1 overflow-hidden rounded-xl">
                            {screenStream
                                ? <ScreenView stream={screenStream} owner={display_name} isLocal onStop={stopScreen} />
                                : sharingPeer?.stream
                                    ? <ScreenView stream={sharingPeer.stream} owner={sharingPeer.display_name} isLocal={false} />
                                    : null}
                        </div>
                    )}

                    <div className={[
                        'grid gap-2',
                        gridCols,
                        anySharing
                            ? 'h-28 shrink-0 auto-cols-[minmax(0,1fr)] overflow-x-auto'
                            : 'min-h-0 flex-1 content-start overflow-y-auto',
                    ].join(' ')}>
                        <div className="aspect-video">
                            <VideoTile peer={localPeer} local />
                        </div>
                        {allPeers.map(p => (
                            <div key={p.peer_id} className="aspect-video">
                                <VideoTile
                                    peer={p}
                                    pinned={!anySharing && p.peer_id === pinnedId}
                                    onClick={() => {
                                        if (!anySharing)
                                            setPinnedId(id => id === p.peer_id ? null : p.peer_id);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat panel */}
                {chatOpen && room.chat_enabled && (
                    <div className="flex w-64 shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
                        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                            <p className="text-sm font-semibold">Chat</p>
                            <button onClick={() => setChatOpen(false)} className="text-zinc-500 transition hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                            {msgs.length === 0 && (
                                <p className="py-8 text-center text-xs text-zinc-600">No messages yet</p>
                            )}
                            {msgs.map(m => (
                                <div key={m.id} className="text-xs">
                                    <span className="font-semibold text-zinc-300">
                                        {m.peer_id === peer_id ? 'You' : m.display_name}
                                    </span>
                                    <span className="ml-1 break-words text-zinc-400">{m.text}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="border-t border-zinc-800 p-3">
                            <input
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder="Message…"
                                className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-primary"
                                onKeyDown={e => {
                                    if (e.key !== 'Enter' || !chatInput.trim()) return;
                                    const msg: ChatMsg = {
                                        id: crypto.randomUUID(), peer_id, display_name,
                                        text: chatInput.trim(), sent_at: new Date().toISOString(),
                                    };
                                    R.current.seenMsgs.add(msg.id);
                                    R.current.channel?.whisper('chat', msg);
                                    setMsgs(ms => [...ms, msg]);
                                    setChatInput('');
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Participants panel */}
                {panelOpen && (
                    <div className="flex w-56 shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
                        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                            <p className="text-sm font-semibold">
                                People <span className="text-zinc-500">({total})</span>
                            </p>
                            <button onClick={() => setPanelOpen(false)} className="text-zinc-500 transition hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2 text-xs">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${localSpeak ? 'bg-green-500' : 'bg-primary/40'}`}>
                                    {display_name[0]?.toUpperCase()}
                                </div>
                                <span className="min-w-0 flex-1 truncate font-medium text-zinc-200">{display_name} (You)</span>
                                <div className="flex shrink-0 gap-1">
                                    {!audioOn && <MicOff className="h-3 w-3 text-red-400" />}
                                    {is_owner && <Shield className="h-3 w-3 text-primary" />}
                                </div>
                            </div>
                            {allPeers.map(p => (
                                <div key={p.peer_id}
                                    className="group flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:bg-zinc-800/50">
                                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${p.speaking ? 'bg-green-500' : 'bg-zinc-700'}`}>
                                        {p.display_name[0]?.toUpperCase()}
                                    </div>
                                    <span className="min-w-0 flex-1 truncate text-zinc-300">{p.display_name}</span>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {!p.audio_on && <MicOff className="h-3 w-3 text-red-400" />}
                                        {p.hand_raised && <Hand className="h-3 w-3 text-yellow-400" />}
                                        {p.role === 'host' && <Shield className="h-3 w-3 text-primary" />}
                                        {is_owner && p.role !== 'host' && (
                                            <button
                                                onClick={() => http.patch(`/meet/${room.uid}/kick/${p.peer_id}`).catch(() => {})}
                                                title="Remove participant"
                                                className="ml-0.5 hidden rounded p-0.5 text-zinc-500 transition hover:bg-red-600/20 hover:text-red-400 group-hover:block">
                                                <UserX className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-zinc-800/80 bg-zinc-950 py-3">
                <Btn on={audioOn} onClick={toggleAudio} title={audioOn ? 'Mute' : 'Unmute'}>
                    {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </Btn>

                {room.video_enabled && (
                    <Btn on={videoOn} onClick={toggleVideo} title={videoOn ? 'Camera off' : 'Camera on'}>
                        {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </Btn>
                )}

                {room.screen_share_enabled && (
                    <Btn blue on={!!screenStream}
                        onClick={screenStream ? stopScreen : startScreen}
                        title={screenStream ? 'Stop sharing' : 'Share screen'}>
                        {screenStream ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
                    </Btn>
                )}

                <Btn yellow on={handRaised} onClick={toggleHand} title={handRaised ? 'Lower hand' : 'Raise hand'}>
                    <Hand className="h-5 w-5" />
                </Btn>

                {room.recording_enabled && is_owner && (
                    <Btn on={!rec.active}
                        onClick={rec.active ? stopRec : startRec}
                        title={rec.active ? 'Stop recording' : 'Start recording'}>
                        {rec.active ? <Square className="h-4 w-4 fill-white" /> : <Circle className="h-4 w-4" />}
                    </Btn>
                )}

                {room.chat_enabled && (
                    <Btn blue on={chatOpen}
                        onClick={() => { setChatOpen(c => !c); setPanelOpen(false); }}
                        title="Chat">
                        <MessageSquare className="h-5 w-5" />
                    </Btn>
                )}

                <Btn blue on={panelOpen}
                    onClick={() => { setPanelOpen(p => !p); setChatOpen(false); }}
                    title="Participants">
                    <Users className="h-5 w-5" />
                </Btn>

                <Btn red wide onClick={() => is_owner ? setHostDialog(true) : leaveRoom()} title="Leave">
                    <PhoneOff className="h-5 w-5" />
                </Btn>
            </footer>
        </div>
    );
}
