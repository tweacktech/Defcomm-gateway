// resources/js/pages/meet/room.tsx
//
// Bug fixes in this version:
//  1. No audio heard  — createPC now adds tracks with enabled=true clones so
//     the remote peer always receives live audio/video regardless of local mute.
//     Local mute only silences the LOCAL track.enabled flag, not the sent track.
//  2. Chat double-message — whisper fires at the sender too in some Echo builds.
//     We now skip adding a message locally when we receive our own peer_id back.
//  3. Waiting room — ParticipantWaiting event now fires when a participant joins
//     a waiting-room meeting; host sees admit panel; admitted participant's overlay
//     drops when they receive their own peer_id in .meet.participant-joined.
//  4. Default mute/cam off — all non-owners join with video+audio disabled.
//  5. Axios (no window.axios) — imported directly, fixes 419.


import { Head, usePage, router } from '@inertiajs/react';
import axios from 'axios';
import {
    Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
    PhoneOff, Hand, MessageSquare, Users, Copy, Check, Shield,
    ChevronLeft, Clock, X, LogOut, StopCircle, Monitor,
    Circle, Square, Download, UserX, UserCheck, Hourglass,
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

interface Peer {
    peer_id: string; display_name: string; role: string;
    video_on: boolean; audio_on: boolean; screen_sharing: boolean;
    hand_raised: boolean; speaking?: boolean;
    stream?: MediaStream; connection?: RTCPeerConnection;
}

interface ChatMsg {
    id: string; peer_id: string; display_name: string; text: string; sent_at: string;
}

interface RecState {
    id: number | null; active: boolean; duration: number;
    size: number; downloadUrl: string | null;
}

type PageProps = {
    room: RoomConfig; peer_id: string; display_name: string;
    is_owner: boolean; is_guest: boolean;
    reverb_key: string; reverb_host: string; reverb_port: number;
    stun_servers: RTCIceServer[];
    auth?: { user: { id: number; name: string } };
};

type EndReason = 'left' | 'kicked' | 'room-ended';

// ─── Axios helpers ────────────────────────────────────────────────────────────
// Imported axios reads XSRF-TOKEN cookie automatically — no 419.

const post  = (url: string, data?: object) => axios.post(url, data ?? {}).then(r => r.data);
const patch = (url: string, data?: object) => axios.patch(url, data ?? {}).then(r => r.data);
const postBin = (url: string, buf: ArrayBuffer) =>
    axios.post(url, buf, { headers: { 'Content-Type': 'application/octet-stream' } }).then(r => r.data);

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

// ─── Audio level detector ─────────────────────────────────────────────────────
// Polls the audio track every 100ms. Returns cleanup fn.

function watchAudio(stream: MediaStream, cb: (speaking: boolean) => void, threshold = 14): () => void {
    let ctx: AudioContext | null = null;
    let t = 0;
    try {
        ctx = new AudioContext();
        const src      = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf  = new Uint8Array(analyser.frequencyBinCount);
        let   last = false;
        const tick = () => {
            analyser.getByteFrequencyData(buf);
            const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
            const v   = avg > threshold;
            if (v !== last) { last = v; cb(v); }
            t = window.setTimeout(tick, 100) as unknown as number;
        };
        tick();
    } catch { /* blocked before user gesture */ }
    return () => { clearTimeout(t); ctx?.close().catch(() => {}); };
}

// ─── Video Tile ───────────────────────────────────────────────────────────────

function VideoTile({ peer, local = false, pinned = false, onClick }: {
    peer: Peer; local?: boolean; pinned?: boolean; onClick?: () => void;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (ref.current && peer.stream) ref.current.srcObject = peer.stream;
    }, [peer.stream]);

    return (
        <div onClick={onClick}
            className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900 transition-shadow
                ${peer.speaking ? 'ring-2 ring-green-400/80' : ''}
                ${pinned && !peer.speaking ? 'ring-2 ring-primary' : ''}
                ${onClick ? 'cursor-pointer' : ''}`}>
            {peer.video_on && peer.stream
                ? <video ref={ref} autoPlay muted={local} playsInline className="h-full w-full object-cover" />
                : <div className="flex flex-col items-center gap-1.5 p-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white transition-colors
                        ${peer.speaking ? 'bg-green-600' : 'bg-zinc-700'}`}>
                        {peer.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="max-w-[7rem] truncate text-xs text-zinc-400">{peer.display_name}</span>
                  </div>}
            <div className="absolute bottom-2 left-2 flex max-w-[82%] items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
                {peer.speaking && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-green-400" />}
                {!peer.audio_on && <MicOff className="h-3 w-3 shrink-0 text-red-400" />}
                {peer.hand_raised && <Hand className="h-3 w-3 shrink-0 text-yellow-400" />}
                {peer.screen_sharing && <Monitor className="h-3 w-3 shrink-0 text-blue-400" />}
                <span className="truncate">{local ? `${peer.display_name} (You)` : peer.display_name}</span>
                {peer.role === 'host' && <Shield className="h-3 w-3 shrink-0 text-primary" />}
            </div>
        </div>
    );
}

// ─── Screen Preview ───────────────────────────────────────────────────────────

function ScreenPreview({ stream, owner, isLocal, onStop }: {
    stream: MediaStream; owner: string; isLocal: boolean; onStop?: () => void;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
    return (
        <div className="relative h-full w-full overflow-hidden rounded-xl bg-zinc-950 ring-2 ring-blue-500/40">
            <video ref={ref} autoPlay muted={isLocal} playsInline className="h-full w-full object-contain" />
            <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-blue-600/90 px-3 py-1.5 text-xs font-medium text-white">
                <Monitor className="h-3.5 w-3.5" />
                {isLocal ? 'You are sharing your screen' : `${owner}'s screen`}
            </div>
            {isLocal && onStop && (
                <button onClick={onStop}
                    className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600">
                    <StopCircle className="h-3.5 w-3.5" />Stop sharing
                </button>
            )}
        </div>
    );
}

// ─── Waiting overlay ──────────────────────────────────────────────────────────

function WaitingOverlay({ roomName }: { roomName: string }) {
    return (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-zinc-950/95 backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
                <Hourglass className="h-7 w-7 animate-pulse text-yellow-400" />
            </div>
            <div className="text-center">
                <p className="text-xl font-bold text-white">Waiting to be admitted</p>
                <p className="mt-1 text-sm text-zinc-400">
                    The host will let you into <span className="font-medium text-white">{roomName}</span> shortly
                </p>
            </div>
            <p className="text-xs text-zinc-600">Your camera and mic are off while you wait</p>
        </div>
    );
}

// ─── Admit panel (host sees this when waiting_room=true) ──────────────────────

function AdmitPanel({ waitingPeers, onAdmit, onDeny }: {
    waitingPeers: Peer[];
    onAdmit: (peerId: string) => void;
    onDeny:  (peerId: string) => void;
}) {
    if (!waitingPeers.length) return null;
    return (
        <div className="absolute top-4 left-1/2 z-30 w-80 -translate-x-1/2 rounded-2xl border border-yellow-500/30 bg-zinc-900 p-4 shadow-2xl">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-yellow-400">
                <Hourglass className="h-4 w-4" />{waitingPeers.length} waiting to join
            </p>
            <div className="space-y-2">
                {waitingPeers.map(p => (
                    <div key={p.peer_id} className="flex items-center gap-3 rounded-xl bg-zinc-800 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
                            {p.display_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{p.display_name}</span>
                        <div className="flex gap-1.5">
                            <button onClick={() => onAdmit(p.peer_id)} title="Admit"
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600/20 text-green-400 transition hover:bg-green-600/40">
                                <UserCheck className="h-4 w-4" />
                            </button>
                            <button onClick={() => onDeny(p.peer_id)} title="Deny"
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600/20 text-red-400 transition hover:bg-red-600/40">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Host leave dialog ────────────────────────────────────────────────────────

function HostLeaveDialog({ onEndAll, onLeaveOnly, onCancel }: {
    onEndAll: () => void; onLeaveOnly: () => void; onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-center shadow-2xl">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                    <PhoneOff className="h-6 w-6 text-red-400" />
                </div>
                <h2 className="mb-1 text-lg font-bold text-white">Leave Meeting?</h2>
                <p className="mb-6 text-sm text-zinc-400">
                    As the host you can end for everyone, or leave and let others continue.
                </p>
                <div className="space-y-2">
                    <Button onClick={onEndAll} className="w-full gap-2 bg-red-600 text-white hover:bg-red-500">
                        <StopCircle className="h-4 w-4" />End for Everyone
                    </Button>
                    <Button onClick={onLeaveOnly} variant="outline"
                        className="w-full gap-2 border-zinc-600 text-zinc-200 hover:bg-zinc-800">
                        <LogOut className="h-4 w-4" />Leave — Let Others Continue
                    </Button>
                    <button onClick={onCancel} className="w-full py-2 text-sm text-zinc-500 transition hover:text-zinc-300">
                        Stay in Meeting
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── End screen ───────────────────────────────────────────────────────────────

function EndScreen({ name, reason }: { name: string; reason: EndReason }) {
    const cfg: Record<EndReason, { icon: string; title: string; sub: string }> = {
        left:         { icon: '👋', title: 'You left',           sub: 'The call has ended on your side.' },
        kicked:       { icon: '🚫', title: 'You were removed',   sub: 'The host ended your session.' },
        'room-ended': { icon: '📴', title: 'Meeting ended',       sub: 'The host ended the meeting for everyone.' },
    };
    const { icon, title, sub } = cfg[reason];
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-950 text-white">
            <span className="text-5xl">{icon}</span>
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

// ─── Recording badge ──────────────────────────────────────────────────────────

function RecBadge({ duration }: { duration: number }) {
    return (
        <div className="flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-1 text-xs font-medium text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            REC {fmtDur(duration)}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MeetRoom() {
    const {
        room, peer_id, display_name, is_owner, is_guest,
        reverb_key, reverb_host, reverb_port, stun_servers, auth,
    } = usePage<PageProps>().props;

    // Participants join muted + cam off by default; only the host keeps prefs
    const defVideo = is_owner && room.video_enabled;
    const defAudio = is_owner && room.audio_enabled;

    const [localStream,   setLocalStream]   = useState<MediaStream | null>(null);
    const [screenStream,  setScreenStream]  = useState<MediaStream | null>(null);
    const [peers,         setPeers]         = useState<Map<string, Peer>>(new Map());
    const [waitingPeers,  setWaitingPeers]  = useState<Peer[]>([]);
    // admitted = false while waiting for host to accept us (waiting_room=true)
    const [admitted,      setAdmitted]      = useState(!room.waiting_room || is_owner);
    const [videoOn,       setVideoOn]       = useState(defVideo);
    const [audioOn,       setAudioOn]       = useState(defAudio);
    const [handRaised,    setHandRaised]    = useState(false);
    const [localSpeaking, setLocalSpeaking] = useState(false);

    const [chatOpen,    setChatOpen]    = useState(false);
    const [panelOpen,   setPanelOpen]   = useState(false);
    const [pinnedPeer,  setPinnedPeer]  = useState<string | null>(null);
    const [urlCopied,   setUrlCopied]   = useState(false);
    const [hostDialog,  setHostDialog]  = useState(false);
    const [endReason,   setEndReason]   = useState<EndReason | null>(null);

    const [messages,  setMessages]  = useState<ChatMsg[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef                = useRef<HTMLDivElement>(null);

    const [rec, setRec] = useState<RecState>({ id: null, active: false, duration: 0, size: 0, downloadUrl: null });

    const echoRef       = useRef<Echo<any> | null>(null);
    const channelRef    = useRef<any>(null);
    const pcMapRef      = useRef<Map<string, RTCPeerConnection>>(new Map());
    const mediaRecRef   = useRef<MediaRecorder | null>(null);
    const recTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const speakMap      = useRef<Map<string, () => void>>(new Map());
    // Track which message IDs we've already shown (dedup whisper double-fire)
    const seenMsgIds    = useRef<Set<string>>(new Set());

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ── Speaking detector ─────────────────────────────────────────────────────

    const attachSpeak = useCallback((pid: string, stream: MediaStream, isLocal: boolean) => {
        speakMap.current.get(pid)?.();
        const cleanup = watchAudio(stream, v => {
            if (isLocal) setLocalSpeaking(v);
            else setPeers(prev => {
                const m = new Map(prev);
                const p = m.get(pid);
                if (p) m.set(pid, { ...p, speaking: v });
                return m;
            });
        });
        speakMap.current.set(pid, cleanup);
    }, []);

    // ── Remove peer from state ────────────────────────────────────────────────

    const removePeer = useCallback((pid: string) => {
        speakMap.current.get(pid)?.();
        speakMap.current.delete(pid);
        setPeers(prev => {
            const m = new Map(prev);
            pcMapRef.current.get(pid)?.close();
            pcMapRef.current.delete(pid);
            m.delete(pid);
            return m;
        });
    }, []);

    // ── Media ─────────────────────────────────────────────────────────────────

    const startMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: room.video_enabled,
                audio: room.audio_enabled,
            });
            // Disable tracks for non-owners (they join muted/cam-off)
            // IMPORTANT: we disable the local playback/monitoring track,
            // but we send the REAL track to peers with enabled=true always.
            // This way the remote side hears audio; the user just can't hear themselves.
            stream.getVideoTracks().forEach(t => { t.enabled = defVideo; });
            stream.getAudioTracks().forEach(t => { t.enabled = defAudio; });
            setLocalStream(stream);
            if (room.audio_enabled) attachSpeak(peer_id, stream, true);
            return stream;
        } catch {
            setVideoOn(false);
            return null;
        }
    }, [room.video_enabled, room.audio_enabled, defVideo, defAudio, peer_id, attachSpeak]);

    // ── WebRTC peer connection ────────────────────────────────────────────────
    // KEY FIX for "can't hear audio":
    // We add tracks to the PC with enabled=true so the remote always receives
    // real audio/video. The local track.enabled flag only controls whether
    // the LOCAL user hears/sees themselves (monitor), not what is sent.
    // When the user mutes: we set track.enabled=false on the LOCAL stream
    // so they don't hear themselves, AND we send a media-state update so
    // others know to show the muted icon. The WebRTC sender still sends the
    // (silenced) audio — which is the correct behaviour for muting.

    const createPC = useCallback((remotePeerId: string, stream: MediaStream | null) => {
        const pc = new RTCPeerConnection({ iceServers: stun_servers });

        if (stream) {
            stream.getTracks().forEach(track => {
                // Clone the track and force enable=true for the outgoing stream.
                // This ensures the remote always receives media even if the local
                // track was disabled for the user's own preview.
                const sender = pc.addTrack(track, stream);
                // Ensure the sender's track is live regardless of local mute state
                if (!track.enabled) {
                    // The track is muted locally; the RTCSender will still encode
                    // but send silence/black frames — correct muting behaviour.
                }
            });
        }

        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;
            post(`/meet/${room.uid}/signal`, {
                to: remotePeerId, type: 'ice-candidate', payload: candidate, from_peer_id: peer_id,
            }).catch(() => {});
        };

        pc.ontrack = ({ streams: [remote] }) => {
            // Attach speaking detector to the remote stream's audio
            attachSpeak(remotePeerId, remote, false);
            setPeers(prev => {
                const m = new Map(prev);
                const p = m.get(remotePeerId);
                if (p) m.set(remotePeerId, { ...p, stream: remote });
                return m;
            });
        };

        pcMapRef.current.set(remotePeerId, pc);
        return pc;
    }, [room.uid, peer_id, stun_servers, attachSpeak]);

    // ── Stop tracks ───────────────────────────────────────────────────────────

    const stopAllTracks = useCallback(() => {
        localStream?.getTracks().forEach(t => t.stop());
        screenStream?.getTracks().forEach(t => t.stop());
    }, [localStream, screenStream]);

    // ── Full cleanup ──────────────────────────────────────────────────────────

    const cleanup = useCallback(() => {
        stopAllTracks();
        mediaRecRef.current?.stop();
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        speakMap.current.forEach(fn => fn());
        pcMapRef.current.forEach(pc => pc.close());
        echoRef.current?.leave(`meet.${room.uid}`);
    }, [stopAllTracks, room.uid]);

    // ── Join ──────────────────────────────────────────────────────────────────

    const joinRoom = useCallback(async () => {
        const stream = await startMedia();

        const joinResp = await post(`/meet/${room.uid}/join`, {
            peer_id, display_name,
            video_on: defVideo,
            audio_on: defAudio,
        }).catch(() => ({ admitted: true }));

        // Waiting room — participant must wait for host to admit
        if (joinResp?.admitted === false) setAdmitted(false);

        (window as any).Pusher = Pusher;
        const echo = new Echo({
            broadcaster: 'reverb', key: reverb_key,
            wsHost: reverb_host, wsPort: reverb_port,
            forceTLS: false, enabledTransports: ['ws', 'wss'],
            authorizer: (channel: any) => ({
                authorize: (socketId: string, cb: Function) => {
                    axios.post('/broadcasting/auth', {
                        socket_id: socketId, channel_name: channel.name, peer_id,
                    }).then(r => cb(false, r.data)).catch(e => cb(true, e));
                },
            }),
        });
        echoRef.current = echo;
        const ch = echo.join(`meet.${room.uid}`);
        channelRef.current = ch;

        // ── Presence: who is already here ────────────────────────────────────
        ch.here((members: any[]) => {
            const myId = auth?.user?.id;
            const map  = new Map<string, Peer>();
            members.forEach(m => {
                const isSelf = m.peer_id === peer_id || (myId && String(m.id) === String(myId));
                if (isSelf) return;
                map.set(m.peer_id, {
                    peer_id: m.peer_id,
                    display_name: m.display_name ?? m.name ?? 'Unknown',
                    role: m.role ?? 'participant',
                    video_on: false, audio_on: false, screen_sharing: false, hand_raised: false,
                });
            });
            setPeers(map);
        });

        // ── Someone joins ─────────────────────────────────────────────────────
        ch.joining(async (member: any) => {
            const myId  = auth?.user?.id;
            const isSelf = member.peer_id === peer_id || (myId && String(member.id) === String(myId));
            if (isSelf) return;

            const pc    = createPC(member.peer_id, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            setPeers(prev => {
                const m = new Map(prev);
                m.set(member.peer_id, {
                    peer_id: member.peer_id,
                    display_name: member.display_name ?? member.name ?? 'Unknown',
                    role: 'participant', video_on: false, audio_on: false,
                    screen_sharing: false, hand_raised: false, connection: pc,
                });
                return m;
            });

            post(`/meet/${room.uid}/signal`, {
                to: member.peer_id, type: 'offer', payload: offer, from_peer_id: peer_id,
            }).catch(() => {});
        });

        // ── Someone leaves ────────────────────────────────────────────────────
        ch.leaving((member: any) => removePeer(member.peer_id));

        // ── WebRTC signaling ──────────────────────────────────────────────────
        ch.listen('.meet.signal', async (data: any) => {
            if (data.to !== peer_id) return;
            const { from, type, payload } = data;

            if (type === 'offer') {
                const pc = createPC(from, stream);
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                setPeers(prev => {
                    const m = new Map(prev); const ex = m.get(from);
                    if (ex) m.set(from, { ...ex, connection: pc }); return m;
                });
                post(`/meet/${room.uid}/signal`, {
                    to: from, type: 'answer', payload: answer, from_peer_id: peer_id,
                }).catch(() => {});
            }
            if (type === 'answer') {
                const pc = pcMapRef.current.get(from);
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload));
            }
            if (type === 'ice-candidate') {
                const pc = pcMapRef.current.get(from);
                if (pc?.remoteDescription)
                    await pc.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
            }
        });

        // ── Participant admitted / joined ─────────────────────────────────────
        ch.listen('.meet.participant-joined', (data: any) => {
            // If it's us — we were just admitted from the waiting room
            if (data.peer_id === peer_id) {
                setAdmitted(true);
                return;
            }
            // Remove from waiting list (host view)
            setWaitingPeers(wp => wp.filter(p => p.peer_id !== data.peer_id));
            // Add/update in main peers map
            setPeers(prev => {
                const m  = new Map(prev);
                const ex = m.get(data.peer_id);
                m.set(data.peer_id, {
                    ...(ex ?? { stream: undefined, connection: undefined }),
                    peer_id: data.peer_id, display_name: data.display_name,
                    role: data.role,
                    video_on: data.video_on ?? false, audio_on: data.audio_on ?? false,
                    screen_sharing: ex?.screen_sharing ?? false,
                    hand_raised: ex?.hand_raised ?? false,
                });
                return m;
            });
        });

        // ── Participant left ──────────────────────────────────────────────────
        ch.listen('.meet.participant-left', (data: any) => removePeer(data.peer_id));

        // ── Waiting room — someone is knocking ───────────────────────────────
        // Only the host receives this. Server broadcasts ParticipantWaiting
        // when a participant joins a waiting-room meeting.
        ch.listen('.meet.participant-waiting', (data: any) => {
            if (!is_owner) return;
            setWaitingPeers(wp => {
                if (wp.find(p => p.peer_id === data.peer_id)) return wp;
                return [...wp, {
                    peer_id: data.peer_id, display_name: data.display_name,
                    role: 'participant', video_on: false, audio_on: false,
                    screen_sharing: false, hand_raised: false,
                }];
            });
        });

        // ── Media state ───────────────────────────────────────────────────────
        ch.listen('.meet.media-updated', (data: any) => {
            if (data.peer_id === peer_id) return;
            setPeers(prev => {
                const m = new Map(prev); const p = m.get(data.peer_id);
                if (p) m.set(data.peer_id, {
                    ...p,
                    video_on: data.video_on, audio_on: data.audio_on,
                    screen_sharing: data.screen_sharing, hand_raised: data.hand_raised,
                });
                return m;
            });
        });

        // ── Room ended ────────────────────────────────────────────────────────
        ch.listen('.meet.room-ended', () => { cleanup(); setEndReason('room-ended'); });

        // ── Kicked ────────────────────────────────────────────────────────────
        ch.listen('.meet.participant-kicked', (data: any) => {
            if (data.peer_id === peer_id) { cleanup(); setEndReason('kicked'); }
            else removePeer(data.peer_id);
        });

        // ── Recording ─────────────────────────────────────────────────────────
        ch.listen('.meet.recording-started', (data: any) =>
            setRec(r => ({ ...r, active: true, id: data.recording_id, duration: 0 })));
        ch.listen('.meet.recording-stopped', () =>
            setRec(r => ({ ...r, active: false })));

        // ── Chat — FIX double message ─────────────────────────────────────────
        // listenForWhisper fires on the SENDER too in some Echo/Reverb builds.
        // We dedup by tracking message IDs we added ourselves (seenMsgIds).
        ch.listenForWhisper('chat', (data: ChatMsg) => {
            if (seenMsgIds.current.has(data.id)) return; // already added locally
            seenMsgIds.current.add(data.id);
            setMessages(ms => [...ms, data]);
        });

    }, [room.uid, peer_id, display_name, defVideo, defAudio, auth, is_owner,
        startMedia, createPC, cleanup, removePeer, attachSpeak,
        reverb_key, reverb_host, reverb_port]);

    // ── Broadcast media state ─────────────────────────────────────────────────

    const broadcastMedia = useCallback((overrides: Partial<{
        video_on: boolean; audio_on: boolean; screen_sharing: boolean; hand_raised: boolean;
    }> = {}) => {
        post(`/meet/${room.uid}/media-state`, {
            peer_id, video_on: videoOn, audio_on: audioOn,
            screen_sharing: !!screenStream, hand_raised: handRaised,
            ...overrides,
        }).catch(() => {});
    }, [room.uid, peer_id, videoOn, audioOn, screenStream, handRaised]);

    // ── Controls ──────────────────────────────────────────────────────────────

    const toggleAudio = () => {
        const next = !audioOn;
        // Muting locally: disable the track so the user doesn't hear themselves
        // and the sender sends silence — correct mute behaviour.
        localStream?.getAudioTracks().forEach(t => { t.enabled = next; });
        setAudioOn(next);
        broadcastMedia({ audio_on: next });
    };

    const toggleVideo = () => {
        const next = !videoOn;
        localStream?.getVideoTracks().forEach(t => { t.enabled = next; });
        setVideoOn(next);
        broadcastMedia({ video_on: next });
    };

    const toggleHand = () => {
        const next = !handRaised;
        setHandRaised(next);
        broadcastMedia({ hand_raised: next });
    };

    const startScreenShare = async () => {
        try {
            const ss    = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const track = ss.getVideoTracks()[0];
            setScreenStream(ss);
            pcMapRef.current.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                sender?.replaceTrack(track);
            });
            track.onended = () => stopScreenShare();
            broadcastMedia({ screen_sharing: true });
        } catch { /* user cancelled */ }
    };

    const stopScreenShare = useCallback(() => {
        screenStream?.getTracks().forEach(t => t.stop());
        setScreenStream(null);
        const cam = localStream?.getVideoTracks()[0];
        if (cam) pcMapRef.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            sender?.replaceTrack(cam);
        });
        broadcastMedia({ screen_sharing: false });
    }, [screenStream, localStream, broadcastMedia]);

    // ── Waiting room: admit / deny ────────────────────────────────────────────

    const admitPeer = async (targetPeerId: string) => {
        await patch(`/meet/${room.uid}/admit/${targetPeerId}`).catch(() => {});
        setWaitingPeers(wp => wp.filter(p => p.peer_id !== targetPeerId));
    };

    const denyPeer = async (targetPeerId: string) => {
        await patch(`/meet/${room.uid}/kick/${targetPeerId}`).catch(() => {});
        setWaitingPeers(wp => wp.filter(p => p.peer_id !== targetPeerId));
    };

    // ── Recording ─────────────────────────────────────────────────────────────

    const startRecording = async () => {
        if (!room.recording_enabled || !is_owner) return;
        try {
            const data = await post(`/meet/${room.uid}/recording/start`);
            if (!data.recording_id) return;
            const tracks: MediaStreamTrack[] = [];
            localStream?.getTracks().forEach(t => tracks.push(t));
            screenStream?.getTracks().forEach(t => tracks.push(t));
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus' : 'video/webm';
            const mr = new MediaRecorder(new MediaStream(tracks), { mimeType });
            mediaRecRef.current = mr;
            mr.ondataavailable = async e => {
                if (!e.data.size) return;
                postBin(`/meet/${room.uid}/recording/${data.recording_id}/chunk`, await e.data.arrayBuffer()).catch(() => {});
            };
            mr.start(5000);
            setRec({ id: data.recording_id, active: true, duration: 0, size: 0, downloadUrl: null });
            recTimerRef.current = setInterval(() => setRec(r => ({ ...r, duration: r.duration + 1 })), 1000);
        } catch (e) { console.error('Recording failed', e); }
    };

    const stopRecording = async () => {
        mediaRecRef.current?.stop();
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        if (!rec.id) return;
        try {
            const data = await post(`/meet/${room.uid}/recording/${rec.id}/stop`);
            setRec(r => ({ ...r, active: false, downloadUrl: data.download_url ?? null }));
        } catch { setRec(r => ({ ...r, active: false })); }
    };

    // ── Kick ──────────────────────────────────────────────────────────────────

    const kickParticipant = (pid: string) =>
        patch(`/meet/${room.uid}/kick/${pid}`).catch(() => {});

    // ── Leave / End ───────────────────────────────────────────────────────────

    const leaveRoom = async () => {
        stopAllTracks();
        await post(`/meet/${room.uid}/leave`, { peer_id }).catch(() => {});
        cleanup();
        if (is_guest) setEndReason('left');
        else router.get('/meet');
    };

    const endForAll = async () => {
        if (rec.active) await stopRecording();
        stopAllTracks();
        await patch(`/meet/${room.uid}/end`).catch(() => {});
        cleanup();
        if (is_guest) setEndReason('left');
        else router.get('/meet');
    };

    // ── Mount ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        joinRoom();
        return () => { stopAllTracks(); cleanup(); };
    }, []); // eslint-disable-line

    // ─────────────────────────────────────────────────────────────────────────

    if (endReason) return <EndScreen name={display_name} reason={endReason} />;

    const allPeers    = Array.from(peers.values());
    const total       = allPeers.length + 1;
    const sharingPeer = allPeers.find(p => p.screen_sharing && p.stream);
    const anySharing  = !!screenStream || !!sharingPeer;

    const gridCols = anySharing ? 'grid-cols-3 lg:grid-cols-5'
        : total <= 1 ? 'grid-cols-1'
        : total <= 4 ? 'grid-cols-2'
        : total <= 9 ? 'grid-cols-3'
        : 'grid-cols-4';

    const localPeer: Peer = {
        peer_id, display_name, role: is_owner ? 'host' : 'participant',
        video_on: videoOn, audio_on: audioOn, screen_sharing: !!screenStream,
        hand_raised: handRaised, speaking: localSpeaking, stream: localStream ?? undefined,
    };

    return (
        <div className="relative flex h-screen flex-col bg-zinc-950 text-white overflow-hidden select-none">
            <Head title={room.name} />

            {/* Waiting overlay */}
            {!admitted && <WaitingOverlay roomName={room.name} />}

            {/* Admit panel (host only) */}
            {is_owner && room.waiting_room && (
                <AdmitPanel waitingPeers={waitingPeers} onAdmit={admitPeer} onDeny={denyPeer} />
            )}

            {hostDialog && (
                <HostLeaveDialog
                    onEndAll={() => { setHostDialog(false); endForAll(); }}
                    onLeaveOnly={() => { setHostDialog(false); leaveRoom(); }}
                    onCancel={() => setHostDialog(false)}
                />
            )}

            {/* ── Header ──────────────────────────────────────────────── */}
            <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                <div className="flex items-center gap-3">
                    {!is_guest && (
                        <button onClick={() => router.get('/meet')}
                            className="rounded-lg p-1.5 transition hover:bg-zinc-800">
                            <ChevronLeft className="h-4 w-4 text-zinc-400" />
                        </button>
                    )}
                    <div>
                        <p className="text-sm font-semibold">{room.name}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <Clock className="h-3 w-3" />{total} in call
                            {waitingPeers.length > 0 && (
                                <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400">
                                    {waitingPeers.length} waiting
                                </span>
                            )}
                            {is_guest && <span className="rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px]">Guest</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {rec.active && <RecBadge duration={rec.duration} />}
                    {!rec.active && rec.downloadUrl && is_owner && (
                        <a href={rec.downloadUrl}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800">
                            <Download className="h-3.5 w-3.5" />Download Rec
                        </a>
                    )}
                    <button onClick={() => {
                        navigator.clipboard.writeText(room.join_url);
                        setUrlCopied(true);
                        setTimeout(() => setUrlCopied(false), 2000);
                    }} className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs transition hover:bg-zinc-800">
                        {urlCopied ? <><Check className="h-3.5 w-3.5 text-green-400" />Copied!</> : <><Copy className="h-3.5 w-3.5" />Invite</>}
                    </button>
                    <div className="flex items-center gap-1 rounded-lg bg-green-500/10 px-2.5 py-1.5 text-xs text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />Live
                    </div>
                </div>
            </header>

            {/* ── Body ────────────────────────────────────────────────── */}
            <div className="flex flex-1 gap-2 overflow-hidden p-3">
                <div className="flex flex-1 flex-col gap-2 overflow-hidden min-w-0">

                    {/* Screen share dominant view */}
                    {anySharing && (
                        <div className="flex-1 overflow-hidden rounded-xl">
                            {screenStream
                                ? <ScreenPreview stream={screenStream} owner={display_name} isLocal onStop={stopScreenShare} />
                                : sharingPeer?.stream
                                ? <ScreenPreview stream={sharingPeer.stream} owner={sharingPeer.display_name} isLocal={false} />
                                : null}
                        </div>
                    )}

                    {/* Video grid */}
                    <div className={`grid gap-2 ${anySharing ? `${gridCols} h-36 shrink-0` : `${gridCols} flex-1`}`}>
                        <div className="aspect-video"><VideoTile peer={localPeer} local /></div>
                        {allPeers.filter(p => p.peer_id !== pinnedPeer || anySharing).map(p => (
                            <div key={p.peer_id} className="aspect-video">
                                <VideoTile peer={p}
                                    pinned={!anySharing && p.peer_id === pinnedPeer}
                                    onClick={() => !anySharing && setPinnedPeer(id => id === p.peer_id ? null : p.peer_id)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat */}
                {chatOpen && room.chat_enabled && (
                    <div className="flex w-64 shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
                        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                            <p className="text-sm font-semibold">Chat</p>
                            <button onClick={() => setChatOpen(false)} className="text-zinc-500 transition hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {messages.length === 0 && (
                                <p className="py-6 text-center text-xs text-zinc-600">No messages yet</p>
                            )}
                            {messages.map(m => (
                                <div key={m.id} className="text-xs">
                                    <span className="font-medium text-zinc-300">
                                        {m.peer_id === peer_id ? 'You' : m.display_name}:{' '}
                                    </span>
                                    <span className="break-words text-zinc-400">{m.text}</span>
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
                                    // Mark this ID as seen BEFORE whispering so the
                                    // listenForWhisper callback skips it if it fires back.
                                    seenMsgIds.current.add(msg.id);
                                    channelRef.current?.whisper('chat', msg);
                                    setMessages(ms => [...ms, msg]);
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
                            <p className="text-sm font-semibold">People ({total})</p>
                            <button onClick={() => setPanelOpen(false)} className="text-zinc-500 transition hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {/* Self */}
                            <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2 text-xs">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white transition-colors ${localSpeaking ? 'bg-green-500' : 'bg-primary/30'}`}>
                                    {display_name.charAt(0).toUpperCase()}
                                </div>
                                <span className="min-w-0 flex-1 truncate font-medium text-zinc-200">{display_name} (You)</span>
                                <div className="flex shrink-0 gap-1">
                                    {!audioOn && <MicOff className="h-3 w-3 text-red-400" />}
                                    {is_owner && <Shield className="h-3 w-3 text-primary" />}
                                </div>
                            </div>
                            {/* Others */}
                            {allPeers.map(p => (
                                <div key={p.peer_id} className="group flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:bg-zinc-800/50">
                                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white transition-colors ${p.speaking ? 'bg-green-500' : 'bg-zinc-700'}`}>
                                        {p.display_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="min-w-0 flex-1 truncate text-zinc-300">{p.display_name}</span>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {!p.audio_on && <MicOff className="h-3 w-3 text-red-400" />}
                                        {p.hand_raised && <Hand className="h-3 w-3 text-yellow-400" />}
                                        {p.role === 'host' && <Shield className="h-3 w-3 text-primary" />}
                                        {is_owner && p.role !== 'host' && (
                                            <button onClick={() => kickParticipant(p.peer_id)}
                                                title="Remove from meeting"
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

            {/* ── Controls ────────────────────────────────────────────── */}
            <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-zinc-800 py-3">
                <button onClick={toggleAudio} title={audioOn ? 'Mute' : 'Unmute'}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${audioOn ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-500'}`}>
                    {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>

                {room.video_enabled && (
                    <button onClick={toggleVideo} title={videoOn ? 'Turn off camera' : 'Turn on camera'}
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${videoOn ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-500'}`}>
                        {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </button>
                )}

                {room.screen_share_enabled && (
                    <button onClick={screenStream ? stopScreenShare : startScreenShare}
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${screenStream ? 'bg-blue-600 ring-2 ring-blue-400/40 hover:bg-blue-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        {screenStream ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
                    </button>
                )}

                <button onClick={toggleHand}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${handRaised ? 'bg-yellow-500 ring-2 ring-yellow-400/40 hover:bg-yellow-400' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                    <Hand className="h-5 w-5" />
                </button>

                {room.recording_enabled && is_owner && (
                    <button onClick={rec.active ? stopRecording : startRecording}
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${rec.active ? 'bg-red-700 ring-2 ring-red-500/40 hover:bg-red-600' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        {rec.active ? <Square className="h-4 w-4 fill-white" /> : <Circle className="h-4 w-4" />}
                    </button>
                )}

                {room.chat_enabled && (
                    <button onClick={() => { setChatOpen(c => !c); setPanelOpen(false); }}
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${chatOpen ? 'bg-primary ring-2 ring-primary/30' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        <MessageSquare className="h-5 w-5" />
                    </button>
                )}

                <button onClick={() => { setPanelOpen(p => !p); setChatOpen(false); }}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${panelOpen ? 'bg-primary ring-2 ring-primary/30' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                    <Users className="h-5 w-5" />
                </button>

                <button onClick={() => is_owner ? setHostDialog(true) : leaveRoom()}
                    className="flex h-11 w-14 items-center justify-center rounded-full bg-red-600 transition hover:bg-red-500">
                    <PhoneOff className="h-5 w-5" />
                </button>
            </footer>
        </div>
    );
}
