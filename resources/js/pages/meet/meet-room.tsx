// resources/js/pages/meet/room.tsx
// Full meet room: WebRTC mesh, recording, screen share preview,
// host end/leave dialog, guest end screen, remove users, all Reverb listeners.

import { Head, usePage, router } from '@inertiajs/react';
import {
    Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
    PhoneOff, Hand, MessageSquare, Users, Copy, Check, Shield,
    ChevronLeft, Clock, X, LogOut, StopCircle, Monitor,
    Circle, Square, Download, AlertTriangle, UserX, ChevronDown,
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
    video_on: boolean; audio_on: boolean; screen_sharing: boolean; hand_raised: boolean;
    stream?: MediaStream; connection?: RTCPeerConnection;
}

interface ChatMsg {
    id: string; peer_id: string; display_name: string; text: string; sent_at: string;
}

interface RecordingState {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const csrf = () =>
    document.querySelector<HTMLMetaElement>('meta[name=csrf-token]')?.content ?? '';

const api = (url: string, method = 'POST', body?: object) =>
    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
        body: body ? JSON.stringify(body) : undefined,
    }).then(r => r.json());

const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
};

// ─── Video Tile ───────────────────────────────────────────────────────────────

function VideoTile({ peer, local = false, pinned = false, onClick }: {
    peer: Peer; local?: boolean; pinned?: boolean; onClick?: () => void;
}) {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => { if (ref.current && peer.stream) ref.current.srcObject = peer.stream; }, [peer.stream]);

    return (
        <div onClick={onClick}
            className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900
                ${pinned ? 'ring-2 ring-primary' : ''} ${onClick ? 'cursor-pointer' : ''}`}>
            {peer.video_on && peer.stream
                ? <video ref={ref} autoPlay muted={local} playsInline className="h-full w-full object-cover" />
                : <div className="flex flex-col items-center gap-1.5 p-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-lg font-bold text-white">
                        {peer.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="max-w-[6rem] truncate text-xs text-zinc-400">{peer.display_name}</span>
                  </div>
            }
            <div className="absolute bottom-2 left-2 flex max-w-[80%] items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
                {!peer.audio_on && <MicOff className="h-3 w-3 shrink-0 text-red-400" />}
                {peer.hand_raised && <Hand className="h-3 w-3 shrink-0 text-yellow-400" />}
                {peer.screen_sharing && <Monitor className="h-3 w-3 shrink-0 text-blue-400" />}
                <span className="truncate">{local ? `${peer.display_name} (You)` : peer.display_name}</span>
                {peer.role === 'host' && <Shield className="h-3 w-3 shrink-0 text-primary" />}
            </div>
        </div>
    );
}

// ─── Screen Share Preview ─────────────────────────────────────────────────────

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

// ─── Host Leave Dialog ────────────────────────────────────────────────────────

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
                    As the host you can end for everyone, or just leave and let others continue.
                </p>
                <div className="space-y-2">
                    <Button onClick={onEndAll}
                        className="w-full gap-2 bg-red-600 text-white hover:bg-red-500">
                        <StopCircle className="h-4 w-4" />End for Everyone
                    </Button>
                    <Button onClick={onLeaveOnly} variant="outline"
                        className="w-full gap-2 border-zinc-600 text-zinc-200 hover:bg-zinc-800">
                        <LogOut className="h-4 w-4" />Leave — Let Others Continue
                    </Button>
                    <button onClick={onCancel}
                        className="w-full py-2 text-sm text-zinc-500 transition hover:text-zinc-300">
                        Stay in Meeting
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Guest / Kicked End Screen ────────────────────────────────────────────────

function EndScreen({ name, reason }: { name: string; reason: EndReason }) {
    const cfg = {
        left:         { icon: '👋', title: 'You left the meeting',     sub: 'The call has ended on your side.' },
        kicked:       { icon: '🚫', title: 'You were removed',          sub: 'The host ended your session.' },
        'room-ended': { icon: '📴', title: 'Meeting ended',             sub: 'The host ended the meeting for everyone.' },
    }[reason];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-950 text-white">
            <span className="text-5xl">{cfg.icon}</span>
            <div className="text-center">
                <p className="text-xl font-bold">{cfg.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{cfg.sub}</p>
                <p className="mt-0.5 text-xs text-zinc-600">{name}</p>
            </div>
            <div className="flex gap-3 mt-2">
                <a href="/"
                    className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800">
                    Go Home
                </a>
            </div>
        </div>
    );
}

// ─── Recording Indicator ──────────────────────────────────────────────────────

function RecordingBadge({ duration }: { duration: number }) {
    return (
        <div className="flex items-center gap-1.5 rounded-full bg-red-600/20 px-2.5 py-1 text-xs font-medium text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            REC {fmtDuration(duration)}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MeetRoom() {
    const {
        room, peer_id, display_name, is_owner, is_guest,
        reverb_key, reverb_host, reverb_port, stun_servers,
    } = usePage<PageProps>().props;

    // ── Core state ────────────────────────────────────────────────────────────
    const [localStream,    setLocalStream]    = useState<MediaStream | null>(null);
    const [screenStream,   setScreenStream]   = useState<MediaStream | null>(null);
    const [peers,          setPeers]          = useState<Map<string, Peer>>(new Map());
    const [videoOn,        setVideoOn]        = useState(room.video_enabled);
    const [audioOn,        setAudioOn]        = useState(room.audio_enabled);
    const [handRaised,     setHandRaised]     = useState(false);

    // ── UI panels ─────────────────────────────────────────────────────────────
    const [chatOpen,       setChatOpen]       = useState(false);
    const [panelOpen,      setPanelOpen]      = useState(false);
    const [pinnedPeer,     setPinnedPeer]     = useState<string | null>(null);
    const [urlCopied,      setUrlCopied]      = useState(false);

    // ── Dialogs ───────────────────────────────────────────────────────────────
    const [hostDialog,     setHostDialog]     = useState(false);
    const [endReason,      setEndReason]      = useState<EndReason | null>(null);

    // ── Chat ──────────────────────────────────────────────────────────────────
    const [messages,       setMessages]       = useState<ChatMsg[]>([]);
    const [chatInput,      setChatInput]      = useState('');
    const chatEndRef                          = useRef<HTMLDivElement>(null);

    // ── Recording ─────────────────────────────────────────────────────────────
    const [rec,            setRec]            = useState<RecordingState>({
        id: null, active: false, duration: 0, size: 0, downloadUrl: null,
    });
    const mediaRecRef   = useRef<MediaRecorder | null>(null);
    const recTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
    const recStreamRef  = useRef<MediaStream | null>(null);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const echoRef    = useRef<Echo<any> | null>(null);
    const channelRef = useRef<any>(null);
    const pcMapRef   = useRef<Map<string, RTCPeerConnection>>(new Map());

    // ── Scroll chat to bottom ─────────────────────────────────────────────────
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ─────────────────────────────────────────────────────────────────────────
    // Media
    // ─────────────────────────────────────────────────────────────────────────

    const startMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: room.video_enabled,
                audio: room.audio_enabled,
            });
            setLocalStream(stream);
            return stream;
        } catch {
            setVideoOn(false);
            return null;
        }
    }, [room.video_enabled, room.audio_enabled]);

    // ─────────────────────────────────────────────────────────────────────────
    // WebRTC
    // ─────────────────────────────────────────────────────────────────────────

    const createPC = useCallback((remotePeerId: string, stream: MediaStream | null) => {
        const pc = new RTCPeerConnection({ iceServers: stun_servers });
        stream?.getTracks().forEach(t => pc.addTrack(t, stream));

        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;
            fetch(`/meet/${room.uid}/signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({ to: remotePeerId, type: 'ice-candidate', payload: candidate, from_peer_id: peer_id }),
            });
        };

        pc.ontrack = ({ streams: [remote] }) => {
            setPeers(prev => {
                const m = new Map(prev);
                const p = m.get(remotePeerId);
                if (p) m.set(remotePeerId, { ...p, stream: remote });
                return m;
            });
        };

        pcMapRef.current.set(remotePeerId, pc);
        return pc;
    }, [room.uid, peer_id, stun_servers]);

    // ─────────────────────────────────────────────────────────────────────────
    // Join room
    // ─────────────────────────────────────────────────────────────────────────

    const joinRoom = useCallback(async () => {
        const stream = await startMedia();
        await fetch(`/meet/${room.uid}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
            body: JSON.stringify({ peer_id, display_name, video_on: videoOn, audio_on: audioOn }),
        });

        (window as any).Pusher = Pusher;
        const echo = new Echo({
            broadcaster: 'reverb', key: reverb_key,
            wsHost: reverb_host, wsPort: reverb_port,
            forceTLS: false, enabledTransports: ['ws', 'wss'],
        });
        echoRef.current = echo;
        const ch = echo.join(`meet.${room.uid}`);
        channelRef.current = ch;

        // ── Presence ─────────────────────────────────────────────────────────
        ch.here((members: any[]) => {
            const map = new Map<string, Peer>();
            members.forEach(m => {
                if (m.peer_id !== peer_id) {
                    map.set(m.peer_id, {
                        peer_id: m.peer_id, display_name: m.display_name ?? m.name,
                        role: m.role ?? 'participant',
                        video_on: false, audio_on: false, screen_sharing: false, hand_raised: false,
                    });
                }
            });
            setPeers(map);
        });

        ch.joining(async (member: any) => {
            if (member.peer_id === peer_id) return;
            const pc = createPC(member.peer_id, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            setPeers(prev => {
                const m = new Map(prev);
                m.set(member.peer_id, {
                    peer_id: member.peer_id,
                    display_name: member.display_name ?? member.name,
                    role: 'participant', video_on: false, audio_on: false,
                    screen_sharing: false, hand_raised: false, connection: pc,
                });
                return m;
            });

            fetch(`/meet/${room.uid}/signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify({ to: member.peer_id, type: 'offer', payload: offer, from_peer_id: peer_id }),
            });
        });

        ch.leaving((member: any) => {
            setPeers(prev => {
                const m = new Map(prev);
                pcMapRef.current.get(member.peer_id)?.close();
                pcMapRef.current.delete(member.peer_id);
                m.delete(member.peer_id);
                return m;
            });
        });

        // ── WebRTC signal ────────────────────────────────────────────────────
        ch.listen('.meet.signal', async (data: any) => {
            if (data.to !== peer_id) return;
            const { from, type, payload } = data;

            if (type === 'offer') {
                const pc = createPC(from, stream);
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                setPeers(prev => {
                    const m = new Map(prev);
                    const ex = m.get(from);
                    if (ex) m.set(from, { ...ex, connection: pc });
                    return m;
                });
                fetch(`/meet/${room.uid}/signal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                    body: JSON.stringify({ to: from, type: 'answer', payload: answer, from_peer_id: peer_id }),
                });
            }
            if (type === 'answer') {
                const pc = pcMapRef.current.get(from);
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload));
            }
            if (type === 'ice-candidate') {
                const pc = pcMapRef.current.get(from);
                if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(payload));
            }
        });

        // ── Participant joined (admitted from waiting room) ───────────────────
        ch.listen('.meet.participant-joined', (data: any) => {
            if (data.peer_id === peer_id) return;
            setPeers(prev => {
                const m = new Map(prev);
                const ex = m.get(data.peer_id);
                m.set(data.peer_id, {
                    ...(ex ?? { stream: undefined, connection: undefined }),
                    peer_id: data.peer_id, display_name: data.display_name,
                    role: data.role, is_admitted: data.is_admitted,
                    video_on: data.video_on ?? false, audio_on: data.audio_on ?? false,
                    screen_sharing: ex?.screen_sharing ?? false,
                    hand_raised: ex?.hand_raised ?? false,
                });
                return m;
            });
        });

        // ── Participant left ──────────────────────────────────────────────────
        ch.listen('.meet.participant-left', (data: any) => {
            setPeers(prev => {
                const m = new Map(prev);
                pcMapRef.current.get(data.peer_id)?.close();
                pcMapRef.current.delete(data.peer_id);
                m.delete(data.peer_id);
                return m;
            });
        });

        // ── Media state updated ───────────────────────────────────────────────
        ch.listen('.meet.media-updated', (data: any) => {
            if (data.peer_id === peer_id) return;
            setPeers(prev => {
                const m = new Map(prev);
                const p = m.get(data.peer_id);
                if (p) m.set(data.peer_id, {
                    ...p,
                    video_on: data.video_on, audio_on: data.audio_on,
                    screen_sharing: data.screen_sharing, hand_raised: data.hand_raised,
                });
                return m;
            });
        });

        // ── Room ended ────────────────────────────────────────────────────────
        ch.listen('.meet.room-ended', () => {
            cleanup();
            setEndReason('room-ended');
        });

        // ── Kicked ────────────────────────────────────────────────────────────
        ch.listen('.meet.participant-kicked', (data: any) => {
            if (data.peer_id !== peer_id) {
                // Remove kicked peer from our view
                setPeers(prev => {
                    const m = new Map(prev);
                    pcMapRef.current.get(data.peer_id)?.close();
                    pcMapRef.current.delete(data.peer_id);
                    m.delete(data.peer_id);
                    return m;
                });
                return;
            }
            cleanup();
            setEndReason('kicked');
        });

        // ── Recording started / stopped (listener for non-host participants) ──
        ch.listen('.meet.recording-started', (data: any) => {
            setRec(r => ({ ...r, active: true, id: data.recording_id, duration: 0 }));
        });

        ch.listen('.meet.recording-stopped', () => {
            setRec(r => ({ ...r, active: false }));
        });

        // ── Chat whisper ──────────────────────────────────────────────────────
        ch.listenForWhisper('chat', (data: ChatMsg) => {
            setMessages(ms => [...ms, data]);
        });

    }, [room.uid, peer_id, display_name, videoOn, audioOn, startMedia, createPC, reverb_key, reverb_host, reverb_port]);

    // ─────────────────────────────────────────────────────────────────────────
    // Cleanup
    // ─────────────────────────────────────────────────────────────────────────

    const cleanup = useCallback(() => {
        localStream?.getTracks().forEach(t => t.stop());
        screenStream?.getTracks().forEach(t => t.stop());
        recStreamRef.current?.getTracks().forEach(t => t.stop());
        mediaRecRef.current?.stop();
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        pcMapRef.current.forEach(pc => pc.close());
        echoRef.current?.leave(`meet.${room.uid}`);
    }, [localStream, screenStream, room.uid]);

    // ─────────────────────────────────────────────────────────────────────────
    // Media state broadcast (uses proper event now instead of whisper)
    // ─────────────────────────────────────────────────────────────────────────

    const broadcastMediaState = useCallback((overrides: Partial<{
        video_on: boolean; audio_on: boolean; screen_sharing: boolean; hand_raised: boolean;
    }> = {}) => {
        fetch(`/meet/${room.uid}/media-state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
            body: JSON.stringify({
                peer_id, video_on: videoOn, audio_on: audioOn,
                screen_sharing: !!screenStream, hand_raised: handRaised,
                ...overrides,
            }),
        });
    }, [room.uid, peer_id, videoOn, audioOn, screenStream, handRaised]);

    // ─────────────────────────────────────────────────────────────────────────
    // Controls
    // ─────────────────────────────────────────────────────────────────────────

    const toggleAudio = () => {
        const next = !audioOn;
        localStream?.getAudioTracks().forEach(t => { t.enabled = next; });
        setAudioOn(next);
        broadcastMediaState({ audio_on: next });
    };

    const toggleVideo = () => {
        const next = !videoOn;
        localStream?.getVideoTracks().forEach(t => { t.enabled = next; });
        setVideoOn(next);
        broadcastMediaState({ video_on: next });
    };

    const toggleHand = () => {
        const next = !handRaised;
        setHandRaised(next);
        broadcastMediaState({ hand_raised: next });
    };

    // ── Screen share ──────────────────────────────────────────────────────────

    const startScreenShare = async () => {
        try {
            const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            setScreenStream(ss);
            const track = ss.getVideoTracks()[0];
            pcMapRef.current.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                sender?.replaceTrack(track);
            });
            track.onended = stopScreenShare;
            broadcastMediaState({ screen_sharing: true });
        } catch { /* user cancelled */ }
    };

    const stopScreenShare = useCallback(() => {
        screenStream?.getTracks().forEach(t => t.stop());
        setScreenStream(null);
        const cam = localStream?.getVideoTracks()[0];
        if (cam) {
            pcMapRef.current.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                sender?.replaceTrack(cam);
            });
        }
        broadcastMediaState({ screen_sharing: false });
    }, [screenStream, localStream, broadcastMediaState]);

    // ── Recording ─────────────────────────────────────────────────────────────

    const startRecording = async () => {
        if (!room.recording_enabled || !is_owner) return;

        try {
            const data = await api(`/meet/${room.uid}/recording/start`);
            if (!data.recording_id) return;

            // Capture all local streams (camera + screen if active)
            const tracks: MediaStreamTrack[] = [];
            localStream?.getTracks().forEach(t => tracks.push(t));
            screenStream?.getTracks().forEach(t => tracks.push(t));

            const captureStream = new MediaStream(tracks);
            recStreamRef.current = captureStream;

            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
                ? 'video/webm;codecs=vp9,opus'
                : 'video/webm';

            const mr = new MediaRecorder(captureStream, { mimeType });
            mediaRecRef.current = mr;

            mr.ondataavailable = async (e) => {
                if (e.data.size === 0) return;
                const ab = await e.data.arrayBuffer();
                await fetch(`/meet/${room.uid}/recording/${data.recording_id}/chunk`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'X-CSRF-TOKEN': csrf(),
                    },
                    body: ab,
                });
            };

            mr.start(5000); // send a chunk every 5 seconds

            setRec({ id: data.recording_id, active: true, duration: 0, size: 0, downloadUrl: null });

            // Tick the duration counter
            recTimerRef.current = setInterval(() => {
                setRec(r => ({ ...r, duration: r.duration + 1 }));
            }, 1000);

        } catch (e) {
            console.error('Failed to start recording', e);
        }
    };

    const stopRecording = async () => {
        mediaRecRef.current?.stop();
        if (recTimerRef.current) clearInterval(recTimerRef.current);

        if (!rec.id) return;

        try {
            const data = await api(`/meet/${room.uid}/recording/${rec.id}/stop`);
            setRec(r => ({ ...r, active: false, downloadUrl: data.download_url ?? null }));
        } catch {
            setRec(r => ({ ...r, active: false }));
        }
    };

    // ── Remove user ───────────────────────────────────────────────────────────

    const kickParticipant = async (targetPeerId: string) => {
        if (!is_owner) return;
        await fetch(`/meet/${room.uid}/kick/${targetPeerId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
        });
    };

    // ── Leave / End ───────────────────────────────────────────────────────────

    const leaveRoom = async () => {
        cleanup();
        await fetch(`/meet/${room.uid}/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
            body: JSON.stringify({ peer_id }),
        });
        if (is_guest) setEndReason('left');
        else router.get('/meet');
    };

    const endForAll = async () => {
        if (rec.active) await stopRecording();
        cleanup();
        await fetch(`/meet/${room.uid}/end`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
        });
        if (is_guest) setEndReason('left');
        else router.get('/meet');
    };

    // ── Mount ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        joinRoom();
        return cleanup;
    }, []); // eslint-disable-line

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    if (endReason) return <EndScreen name={display_name} reason={endReason} />;

    const allPeers     = Array.from(peers.values());
    const total        = allPeers.length + 1;
    const sharingPeer  = allPeers.find(p => p.screen_sharing && p.stream);
    const anySharing   = !!screenStream || !!sharingPeer;
    const pinnedData   = pinnedPeer ? peers.get(pinnedPeer) : null;

    const gridCols = anySharing ? 'grid-cols-2 max-h-40'
        : total <= 1 ? 'grid-cols-1'
        : total <= 4 ? 'grid-cols-2'
        : total <= 9 ? 'grid-cols-3'
        : 'grid-cols-4';

    const localPeer: Peer = {
        peer_id, display_name, role: is_owner ? 'host' : 'participant',
        video_on: videoOn, audio_on: audioOn,
        screen_sharing: !!screenStream, hand_raised: handRaised,
        stream: localStream ?? undefined,
    };

    return (
        <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden select-none">
            <Head title={room.name} />

            {hostDialog && (
                <HostLeaveDialog
                    onEndAll={() => { setHostDialog(false); endForAll(); }}
                    onLeaveOnly={() => { setHostDialog(false); leaveRoom(); }}
                    onCancel={() => setHostDialog(false)}
                />
            )}

            {/* ── Header ─────────────────────────────────────────────────── */}
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
                            {is_guest && <span className="rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px]">Guest</span>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Recording badge (visible to all when active) */}
                    {rec.active && <RecordingBadge duration={rec.duration} />}

                    {/* Download link after recording stops */}
                    {!rec.active && rec.downloadUrl && is_owner && (
                        <a href={rec.downloadUrl}
                            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800">
                            <Download className="h-3.5 w-3.5" />Download Recording
                        </a>
                    )}

                    <button onClick={() => { navigator.clipboard.writeText(room.join_url); setUrlCopied(true); setTimeout(() => setUrlCopied(false), 2000); }}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs transition hover:bg-zinc-800">
                        {urlCopied ? <><Check className="h-3.5 w-3.5 text-green-400" />Copied!</> : <><Copy className="h-3.5 w-3.5" />Invite</>}
                    </button>
                    <div className="flex items-center gap-1 rounded-lg bg-green-500/10 px-2.5 py-1.5 text-xs text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />Live
                    </div>
                </div>
            </header>

            {/* ── Body ───────────────────────────────────────────────────── */}
            <div className="flex flex-1 gap-2 overflow-hidden p-3">

                {/* ── Video area ───────────────────────────────────────── */}
                <div className="flex flex-1 flex-col gap-2 overflow-hidden min-w-0">

                    {/* Screen share — dominant view */}
                    {anySharing && (
                        <div className="flex-1 overflow-hidden rounded-xl">
                            {screenStream ? (
                                <ScreenPreview stream={screenStream} owner={display_name} isLocal onStop={stopScreenShare} />
                            ) : sharingPeer?.stream ? (
                                <ScreenPreview stream={sharingPeer.stream} owner={sharingPeer.display_name} isLocal={false} />
                            ) : null}
                        </div>
                    )}

                    {/* Tile grid */}
                    <div className={`grid gap-2 ${anySharing ? 'grid-cols-3 lg:grid-cols-5' : gridCols} ${anySharing ? 'h-40 shrink-0' : 'flex-1'}`}>
                        {/* Pinned tile (full row) — only in non-share mode */}
                        {!anySharing && pinnedData && (
                            <div className="col-span-full mb-1 h-56">
                                <VideoTile peer={pinnedData} pinned onClick={() => setPinnedPeer(null)} />
                            </div>
                        )}

                        {/* Local */}
                        <div className={`aspect-video ${anySharing ? '' : (!anySharing && pinnedData ? '' : '')}`}>
                            <VideoTile peer={localPeer} local />
                        </div>

                        {/* Remotes */}
                        {allPeers
                            .filter(p => anySharing || p.peer_id !== pinnedPeer)
                            .map(p => (
                                <div key={p.peer_id} className="aspect-video">
                                    <VideoTile peer={p}
                                        pinned={!anySharing && p.peer_id === pinnedPeer}
                                        onClick={() => !anySharing && setPinnedPeer(id => id === p.peer_id ? null : p.peer_id)}
                                    />
                                </div>
                            ))
                        }
                    </div>
                </div>

                {/* ── Chat panel ─────────────────────────────────────── */}
                {chatOpen && room.chat_enabled && (
                    <div className="flex w-68 shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900" style={{ width: '272px' }}>
                        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                            <p className="text-sm font-semibold">Chat</p>
                            <button onClick={() => setChatOpen(false)} className="text-zinc-500 transition hover:text-white"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {messages.length === 0 && (
                                <p className="py-6 text-center text-xs text-zinc-600">No messages yet</p>
                            )}
                            {messages.map(m => (
                                <div key={m.id} className="text-xs">
                                    <span className="font-medium text-zinc-300">{m.peer_id === peer_id ? 'You' : m.display_name}: </span>
                                    <span className="text-zinc-400 break-words">{m.text}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div className="border-t border-zinc-800 p-3">
                            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                                placeholder="Message…"
                                className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-primary"
                                onKeyDown={e => {
                                    if (e.key !== 'Enter' || !chatInput.trim()) return;
                                    const msg: ChatMsg = {
                                        id: crypto.randomUUID(), peer_id, display_name,
                                        text: chatInput.trim(), sent_at: new Date().toISOString(),
                                    };
                                    channelRef.current?.whisper('chat', msg);
                                    setMessages(ms => [...ms, msg]);
                                    setChatInput('');
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* ── Participants panel ──────────────────────────────── */}
                {panelOpen && (
                    <div className="flex w-60 shrink-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900">
                        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                            <p className="text-sm font-semibold">Participants ({total})</p>
                            <button onClick={() => setPanelOpen(false)} className="text-zinc-500 transition hover:text-white"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {/* Self */}
                            <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2 text-xs">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                                    {display_name.charAt(0).toUpperCase()}
                                </div>
                                <span className="min-w-0 flex-1 truncate font-medium text-zinc-200">{display_name} (You)</span>
                                <div className="flex shrink-0 gap-1">
                                    {!audioOn && <MicOff className="h-3 w-3 text-red-400" />}
                                    {is_owner && <Shield className="h-3 w-3 text-primary" />}
                                </div>
                            </div>

                            {/* Others — host sees remove button */}
                            {allPeers.map(p => (
                                <div key={p.peer_id} className="group flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition hover:bg-zinc-800/50">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold">
                                        {p.display_name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="min-w-0 flex-1 truncate text-zinc-300">{p.display_name}</span>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {!p.audio_on && <MicOff className="h-3 w-3 text-red-400" />}
                                        {p.hand_raised && <Hand className="h-3 w-3 text-yellow-400" />}
                                        {p.role === 'host' && <Shield className="h-3 w-3 text-primary" />}
                                        {/* Remove button — host only, not for other hosts */}
                                        {is_owner && p.role !== 'host' && (
                                            <button
                                                onClick={() => kickParticipant(p.peer_id)}
                                                title="Remove from meeting"
                                                className="ml-1 hidden rounded p-0.5 text-zinc-500 transition hover:bg-red-600/20 hover:text-red-400 group-hover:block">
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

            {/* ── Controls bar ──────────────────────────────────────────── */}
            <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-zinc-800 py-3">
                {/* Mic */}
                <button onClick={toggleAudio} title={audioOn ? 'Mute' : 'Unmute'}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${audioOn ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-500'}`}>
                    {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>

                {/* Camera */}
                {room.video_enabled && (
                    <button onClick={toggleVideo} title={videoOn ? 'Turn off camera' : 'Turn on camera'}
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${videoOn ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-500'}`}>
                        {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </button>
                )}

                {/* Screen share */}
                {room.screen_share_enabled && (
                    <button onClick={screenStream ? stopScreenShare : startScreenShare}
                        title={screenStream ? 'Stop sharing' : 'Share screen'}
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${screenStream ? 'bg-blue-600 ring-2 ring-blue-400/50 hover:bg-blue-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        {screenStream ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
                    </button>
                )}

                {/* Raise hand */}
                <button onClick={toggleHand} title={handRaised ? 'Lower hand' : 'Raise hand'}
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${handRaised ? 'bg-yellow-500 ring-2 ring-yellow-400/50 hover:bg-yellow-400' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                    <Hand className="h-5 w-5" />
                </button>

                {/* Recording — host only */}
                {room.recording_enabled && is_owner && (
                    <button
                        onClick={rec.active ? stopRecording : startRecording}
                        title={rec.active ? 'Stop recording' : 'Start recording'}
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${rec.active ? 'bg-red-700 ring-2 ring-red-500/50 hover:bg-red-600' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        {rec.active ? <Square className="h-4 w-4 fill-white" /> : <Circle className="h-4 w-4" />}
                    </button>
                )}

                {/* Chat */}
                {room.chat_enabled && (
                    <button onClick={() => { setChatOpen(c => !c); setPanelOpen(false); }}
                        title="Chat"
                        className={`flex h-11 w-11 items-center justify-center rounded-full transition ${chatOpen ? 'bg-primary ring-2 ring-primary/40' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        <MessageSquare className="h-5 w-5" />
                    </button>
                )}

                {/* Participants */}
                <button onClick={() => { setPanelOpen(p => !p); setChatOpen(false); }}
                    title="Participants"
                    className={`flex h-11 w-11 items-center justify-center rounded-full transition ${panelOpen ? 'bg-primary ring-2 ring-primary/40' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                    <Users className="h-5 w-5" />
                </button>

                {/* Leave / End */}
                <button onClick={() => is_owner ? setHostDialog(true) : leaveRoom()}
                    title={is_owner ? 'End or leave' : 'Leave'}
                    className="flex h-11 w-14 items-center justify-center rounded-full bg-red-600 transition hover:bg-red-500">
                    <PhoneOff className="h-5 w-5" />
                </button>
            </footer>
        </div>
    );
}
