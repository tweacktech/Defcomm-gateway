// resources/js/pages/calls/room.tsx
// Full audio-only WebRTC call room.
// Architecture: ref-based (same pattern as meet/room.tsx) — zero stale closures.

import axios from 'axios';
import { Head, usePage, router } from '@inertiajs/react';
import {
    Mic, MicOff, PhoneOff, Hand, Users, X, Shield,
    Clock, LogOut, StopCircle, UserX, UserCheck,
    Hourglass, AlertTriangle, AlertCircle, Siren, Phone,
    Volume2, VolumeX, ChevronDown,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CallConfig {
    uid: string; title: string; mode: string; status: string;
    priority: string; priority_label: string; priority_color: string; priority_note: string | null;
    initiator_name: string; callee_name: string | null;
    mute_on_join: boolean; waiting_room: boolean; join_url: string;
}

interface Peer {
    peer_id: string; display_name: string; role: string;
    audio_on: boolean; speaking?: boolean; hand_raised?: boolean; is_muted_by_host?: boolean;
    stream?: MediaStream;
}

type EndReason = 'left' | 'kicked' | 'call-ended' | 'declined';

type PageProps = {
    call: CallConfig; peer_id: string; display_name: string; is_host: boolean;
    reverb_key: string; reverb_host: string; reverb_port: number;
    /** Matches REVERB_SCHEME / useTLS */
    reverb_use_tls?: boolean;
    stun_servers: RTCIceServer[];
    auth: { user: { id: number } };
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const post  = (url: string, data?: object) => axios.post(url, data ?? {}).then(r => r.data);
const patch = (url: string, data?: object) => axios.patch(url, data ?? {}).then(r => r.data);
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY_UI: Record<string, { icon: any; bar: string; badge: string; label: string }> = {
    routine:   { icon: Phone,         bar: 'bg-zinc-700',   badge: 'bg-zinc-700/60 text-zinc-300',     label: 'Routine' },
    important: { icon: AlertCircle,   bar: 'bg-blue-600',   badge: 'bg-blue-600/20 text-blue-400',     label: 'Important' },
    urgent:    { icon: AlertTriangle, bar: 'bg-orange-600', badge: 'bg-orange-600/20 text-orange-400', label: 'Urgent' },
    emergency: { icon: Siren,         bar: 'bg-red-600',    badge: 'bg-red-600/20 text-red-400',       label: 'Emergency' },
};

// ─── Speaking detector ────────────────────────────────────────────────────────
function watchAudio(stream: MediaStream, cb: (v: boolean) => void, threshold = 14): () => void {
    let ctx: AudioContext | null = null; let t = 0;
    try {
        ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const an  = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        let last = false;
        const tick = () => {
            an.getByteFrequencyData(buf);
            const v = (buf.reduce((a, b) => a + b, 0) / buf.length) > threshold;
            if (v !== last) { last = v; cb(v); }
            t = window.setTimeout(tick, 100) as unknown as number;
        };
        tick();
    } catch { /* blocked */ }
    return () => { clearTimeout(t); ctx?.close().catch(() => {}); };
}

// ─── Participant tile ─────────────────────────────────────────────────────────
function ParticipantTile({ peer, local = false, onKick, onMute }: {
    peer: Peer; local?: boolean; onKick?: () => void; onMute?: () => void;
}) {
    // Attach audio element for remote stream
    const audioRef = useRef<HTMLAudioElement>(null);
    useEffect(() => {
        if (audioRef.current && peer.stream && !local) {
            audioRef.current.srcObject = peer.stream;
        }
    }, [peer.stream, local]);

    return (
        <div className={`relative flex flex-col items-center gap-2 rounded-2xl border p-5 transition
            ${peer.speaking ? 'border-green-400/70 bg-green-500/5' : 'border-zinc-800 bg-zinc-900'}`}>
            {/* Audio element for remote peers */}
            {!local && <audio ref={audioRef} autoPlay className="hidden" />}

            {/* Avatar */}
            <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white transition-colors
                ${peer.speaking ? 'bg-green-600' : 'bg-zinc-700'}`}>
                {peer.display_name[0].toUpperCase()}
            </div>

            {/* Name + status */}
            <div className="text-center">
                <p className="text-sm font-semibold text-white">{local ? `${peer.display_name} (You)` : peer.display_name}</p>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                    {peer.role === 'host' && <Shield className="h-3 w-3 text-primary" />}
                    {peer.speaking && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />}
                    {!peer.audio_on && <MicOff className="h-3 w-3 text-red-400" />}
                    {peer.hand_raised && <Hand className="h-3 w-3 text-yellow-400" />}
                    {peer.is_muted_by_host && <VolumeX className="h-3 w-3 text-orange-400" />}
                </div>
            </div>

            {/* Host actions */}
            {(onKick || onMute) && (
                <div className="flex gap-1.5">
                    {onMute && (
                        <button onClick={onMute} title="Mute"
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-600/20 text-orange-400 transition hover:bg-orange-600/40">
                            <MicOff className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {onKick && (
                        <button onClick={onKick} title="Remove"
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/20 text-red-400 transition hover:bg-red-600/40">
                            <UserX className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Waiting overlay ──────────────────────────────────────────────────────────
function WaitingOverlay({ callTitle }: { callTitle: string }) {
    return (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-zinc-950/95 backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
                <Hourglass className="h-7 w-7 animate-pulse text-yellow-400" />
            </div>
            <div className="text-center">
                <p className="text-xl font-bold text-white">Waiting to be admitted</p>
                <p className="mt-1 text-sm text-zinc-400">{callTitle}</p>
            </div>
        </div>
    );
}

// ─── Admit panel ─────────────────────────────────────────────────────────────
function AdmitPanel({ waiting, onAdmit, onDeny }: {
    waiting: Peer[]; onAdmit: (id: string) => void; onDeny: (id: string) => void;
}) {
    if (!waiting.length) return null;
    return (
        <div className="absolute top-4 left-1/2 z-30 w-80 -translate-x-1/2 rounded-2xl border border-yellow-500/30 bg-zinc-900 p-4 shadow-2xl">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-yellow-400">
                <Hourglass className="h-4 w-4" />{waiting.length} waiting to join
            </p>
            <div className="space-y-2">
                {waiting.map(p => (
                    <div key={p.peer_id} className="flex items-center gap-3 rounded-xl bg-zinc-800 px-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
                            {p.display_name[0].toUpperCase()}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{p.display_name}</span>
                        <button onClick={() => onAdmit(p.peer_id)} className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600/20 text-green-400 hover:bg-green-600/40 transition">
                            <UserCheck className="h-4 w-4" />
                        </button>
                        <button onClick={() => onDeny(p.peer_id)} className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600/20 text-red-400 hover:bg-red-600/40 transition">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Priority change panel ────────────────────────────────────────────────────
function PriorityPanel({ current, onClose, onChangePriority }: {
    current: string; onClose: () => void;
    onChangePriority: (p: string, note: string) => void;
}) {
    const LEVELS = ['routine', 'important', 'urgent', 'emergency'];
    const [selected, setSelected] = useState(current);
    const [note, setNote]         = useState('');

    return (
        <div className="absolute bottom-24 right-4 z-30 w-72 rounded-2xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Change Priority</p>
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-1.5 mb-3">
                {LEVELS.map(level => {
                    const cfg = PRIORITY_UI[level];
                    return (
                        <button key={level} onClick={() => setSelected(level)}
                            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition
                                ${selected === level ? `${cfg.badge} font-semibold` : 'text-zinc-400 hover:bg-zinc-800'}`}>
                            <cfg.icon className="h-3.5 w-3.5 shrink-0" />{cfg.label}
                        </button>
                    );
                })}
            </div>
            {selected !== 'routine' && (
                <input value={note} onChange={e => setNote(e.target.value)}
                    placeholder="Context note…"
                    className="mb-3 w-full rounded-lg bg-zinc-800 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:ring-1 focus:ring-primary" />
            )}
            <Button onClick={() => { onChangePriority(selected, note); onClose(); }}
                className="w-full h-8 text-xs gap-1.5">Apply Priority</Button>
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
                <h2 className="mb-1 text-lg font-bold text-white">Leave Call?</h2>
                <p className="mb-6 text-sm text-zinc-400">End for everyone or leave and let others continue.</p>
                <div className="space-y-2">
                    <Button onClick={onEndAll} className="w-full gap-2 bg-red-600 text-white hover:bg-red-500">
                        <StopCircle className="h-4 w-4" />End for Everyone
                    </Button>
                    <Button onClick={onLeaveOnly} variant="outline"
                        className="w-full gap-2 border-zinc-600 text-zinc-200 hover:bg-zinc-800">
                        <LogOut className="h-4 w-4" />Leave — Let Others Continue
                    </Button>
                    <button onClick={onCancel} className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 transition">Stay</button>
                </div>
            </div>
        </div>
    );
}

// ─── End screen ───────────────────────────────────────────────────────────────
function EndScreen({ name, reason }: { name: string; reason: EndReason }) {
    const msgs: Record<EndReason, [string, string, string]> = {
        left:        ['👋', 'Call ended',       'You left the call.'],
        kicked:      ['🚫', 'You were removed', 'The host removed you from the call.'],
        'call-ended':['📴', 'Call ended',       'The host ended the call for everyone.'],
        declined:    ['❌', 'Call declined',    'The call was declined.'],
    };
    const [icon, title, sub] = msgs[reason];
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-950 text-white">
            <span className="text-5xl">{icon}</span>
            <div className="text-center">
                <p className="text-xl font-bold">{title}</p>
                <p className="mt-1 text-sm text-zinc-400">{sub}</p>
                <p className="mt-1 text-xs text-zinc-600">{name}</p>
            </div>
            <Button onClick={() => router.get('/calls')} variant="outline"
                className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                <Phone className="h-4 w-4" />Back to Calls
            </Button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CallRoom() {
    const { call, peer_id, display_name, is_host, auth,
            reverb_key, reverb_host, reverb_port, reverb_use_tls, stun_servers } = usePage<PageProps>().props;

    // ── UI state ──────────────────────────────────────────────────────────────
    const [peers,        setPeers]       = useState<Map<string, Peer>>(new Map());
    const [waiting,      setWaiting]     = useState<Peer[]>([]);
    const [admitted,     setAdmitted]    = useState(!call.waiting_room || is_host);
    const [audioOn,      setAudioOn]     = useState(!call.mute_on_join || is_host);
    const [handRaised,   setHandRaised]  = useState(false);
    const [localSpeak,   setLocalSpeak]  = useState(false);
    const [panelOpen,    setPanelOpen]   = useState(false);
    const [hostDialog,   setHostDialog]  = useState(false);
    const [priorityPanel,setPriorityPnl] = useState(false);
    const [endReason,    setEndReason]   = useState<EndReason | null>(null);
    const [priority,     setPriority]    = useState(call.priority);
    const [priorityNote, setPriorityNote]= useState(call.priority_note ?? '');
    const [elapsed,      setElapsed]     = useState(0);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const streamRef   = useRef<MediaStream | null>(null);
    const echoRef     = useRef<Echo<any> | null>(null);
    const pcMap       = useRef<Map<string, RTCPeerConnection>>(new Map());
    const speakMap    = useRef<Map<string, () => void>>(new Map());
    const audioOnRef  = useRef(!call.mute_on_join || is_host);
    const handRef     = useRef(false);
    const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => { audioOnRef.current = audioOn; }, [audioOn]);
    useEffect(() => { handRef.current    = handRaised; }, [handRaised]);

    // ── Elapsed timer ─────────────────────────────────────────────────────────
    useEffect(() => {
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────────

    const attachSpeak = (pid: string, stream: MediaStream, isLocal: boolean) => {
        speakMap.current.get(pid)?.();
        speakMap.current.set(pid, watchAudio(stream, v => {
            if (isLocal) setLocalSpeak(v);
            else setPeers(prev => {
                const m = new Map(prev); const p = m.get(pid);
                if (p) m.set(pid, { ...p, speaking: v }); return m;
            });
        }));
    };

    const removePeer = (pid: string) => {
        speakMap.current.get(pid)?.(); speakMap.current.delete(pid);
        pcMap.current.get(pid)?.close(); pcMap.current.delete(pid);
        setPeers(prev => { const m = new Map(prev); m.delete(pid); return m; });
    };

    const createPC = (remotePeerId: string): RTCPeerConnection => {
        pcMap.current.get(remotePeerId)?.close();
        const pc = new RTCPeerConnection({ iceServers: stun_servers });
        const stream = streamRef.current;

        if (stream) {
            stream.getAudioTracks().forEach(t => pc.addTrack(t, stream));
        }

        pc.onicecandidate = ({ candidate }) => {
            if (!candidate) return;
            post(`/calls/${call.uid}/signal`, {
                to: remotePeerId, type: 'ice-candidate',
                payload: candidate, from_peer_id: peer_id,
            }).catch(() => {});
        };

        pc.ontrack = ({ streams: [remote] }) => {
            attachSpeak(remotePeerId, remote, false);
            setPeers(prev => {
                const m = new Map(prev); const p = m.get(remotePeerId);
                if (p) m.set(remotePeerId, { ...p, stream: remote });
                else m.set(remotePeerId, {
                    peer_id: remotePeerId, display_name: 'Connecting…',
                    role: 'participant', audio_on: true, stream: remote,
                });
                return m;
            });
        };

        pcMap.current.set(remotePeerId, pc);
        return pc;
    };

    const stopAllTracks = () => streamRef.current?.getTracks().forEach(t => t.stop());

    const doCleanup = () => {
        stopAllTracks();
        speakMap.current.forEach(fn => fn());
        pcMap.current.forEach(pc => pc.close());
        echoRef.current?.leave(`call.${call.uid}`);
    };

    // ── Background service ────────────────────────────────────────────────────

    const startService = async () => {
        // Get audio only
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            stream.getAudioTracks().forEach(t => { t.enabled = audioOnRef.current; });
            streamRef.current = stream;
            attachSpeak(peer_id, stream, true);
        } catch { setAudioOn(false); }

        // Tell server we answered
        const resp = await post(`/calls/${call.uid}/answer`, {
            peer_id, display_name,
            audio_on: audioOnRef.current,
        }).catch(() => ({ admitted: true }));

        if (resp?.admitted === false) setAdmitted(false);

        // ── Echo ──────────────────────────────────────────────────────────────
        (window as any).Pusher = Pusher;
        const useTls = reverb_use_tls ?? false;
        const echo = new Echo({
            broadcaster: 'reverb', key: reverb_key,
            wsHost: reverb_host, wsPort: reverb_port,
            forceTLS: useTls,
            enabledTransports: useTls
                ? (['wss'] as ('ws' | 'wss')[])
                : ['ws', 'wss'],
            authorizer: (channel: any) => ({
                authorize: (socketId: string, cb: Function) => {
                    axios.post('/broadcasting/auth', {
                        socket_id: socketId, channel_name: channel.name, peer_id,
                    }).then(r => cb(false, r.data)).catch(e => cb(true, e));
                },
            }),
        });
        echoRef.current = echo;
        const ch = echo.join(`call.${call.uid}`);

        // ── Presence ──────────────────────────────────────────────────────────
        ch.here((members: any[]) => {
            const map = new Map<string, Peer>();
            members.forEach(m => {
                if (m.peer_id === peer_id || String(m.id) === String(auth.user.id)) return;
                map.set(m.peer_id, {
                    peer_id: m.peer_id, display_name: m.display_name ?? m.name ?? 'Unknown',
                    role: m.role ?? 'participant', audio_on: false,
                });
            });
            setPeers(map);
        });

        ch.joining(async (member: any) => {
            if (member.peer_id === peer_id || String(member.id) === String(auth.user.id)) return;
            const pc    = createPC(member.peer_id);
            const offer = await pc.createOffer({ offerToReceiveAudio: true });
            await pc.setLocalDescription(offer);
            setPeers(prev => {
                const m = new Map(prev);
                if (!m.has(member.peer_id)) m.set(member.peer_id, {
                    peer_id: member.peer_id,
                    display_name: member.display_name ?? member.name ?? 'Unknown',
                    role: member.role ?? 'participant', audio_on: false,
                });
                return m;
            });
            post(`/calls/${call.uid}/signal`, {
                to: member.peer_id, type: 'offer', payload: offer, from_peer_id: peer_id,
            }).catch(() => {});
        });

        ch.leaving((member: any) => removePeer(member.peer_id));

        // ── Signaling ─────────────────────────────────────────────────────────
        ch.listen('.call.signal', async (data: any) => {
            if (data.to !== peer_id) return;
            const { from, type, payload } = data;

            if (type === 'offer') {
                const pc = createPC(from);
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                setPeers(prev => {
                    const m = new Map(prev);
                    if (!m.has(from)) m.set(from, { peer_id: from, display_name: 'Connecting…', role: 'participant', audio_on: false });
                    return m;
                });
                post(`/calls/${call.uid}/signal`, {
                    to: from, type: 'answer', payload: answer, from_peer_id: peer_id,
                }).catch(() => {});
            }
            if (type === 'answer') {
                const pc = pcMap.current.get(from);
                if (pc && pc.signalingState !== 'stable')
                    await pc.setRemoteDescription(new RTCSessionDescription(payload)).catch(() => {});
            }
            if (type === 'ice-candidate') {
                const pc = pcMap.current.get(from);
                if (pc?.remoteDescription)
                    await pc.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
            }
        });

        // ── Call events ───────────────────────────────────────────────────────
        ch.listen('.call.participant-joined', (data: any) => {
            if (data.peer_id === peer_id) { setAdmitted(true); return; }
            setWaiting(wp => wp.filter(p => p.peer_id !== data.peer_id));
            setPeers(prev => {
                const m = new Map(prev); const ex = m.get(data.peer_id);
                m.set(data.peer_id, { ...(ex ?? { stream: undefined }), peer_id: data.peer_id, display_name: data.display_name, role: data.role, audio_on: data.audio_on ?? false });
                return m;
            });
        });

        ch.listen('.call.participant-left', (data: any) => removePeer(data.peer_id));

        ch.listen('.call.participant-waiting', (data: any) => {
            if (!is_host) return;
            setWaiting(wp => wp.find(p => p.peer_id === data.peer_id) ? wp : [...wp, {
                peer_id: data.peer_id, display_name: data.display_name,
                role: 'participant', audio_on: false,
            }]);
        });

        ch.listen('.call.participant-muted', (data: any) => {
            if (data.peer_id === peer_id && data.by_host) {
                // Host muted us — apply locally
                streamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
                setAudioOn(false);
            }
            setPeers(prev => {
                const m = new Map(prev); const p = m.get(data.peer_id);
                if (p) m.set(data.peer_id, { ...p, audio_on: !data.muted, is_muted_by_host: data.by_host && data.muted });
                return m;
            });
        });

        ch.listen('.call.participant-kicked', (data: any) => {
            if (data.peer_id === peer_id) { doCleanup(); setEndReason('kicked'); }
            else removePeer(data.peer_id);
        });

        ch.listen('.call.ended', () => { doCleanup(); setEndReason('call-ended'); });
        ch.listen('.call.declined', () => { doCleanup(); setEndReason('declined'); });

        ch.listen('.call.priority-changed', (data: any) => {
            setPriority(data.priority);
            setPriorityNote(data.priority_note ?? '');
        });
    };

    useEffect(() => {
        startService().catch(console.error);
        return doCleanup;
    }, []); // eslint-disable-line

    // ── Controls ──────────────────────────────────────────────────────────────

    const toggleAudio = () => {
        const next = !audioOn;
        streamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
        setAudioOn(next);
        post(`/calls/${call.uid}/audio-state`, { peer_id, audio_on: next }).catch(() => {});
    };

    const toggleHand = () => {
        const next = !handRaised;
        setHandRaised(next);
        // Whisper hand raise state via chat channel
    };

    const admitPeer = async (pid: string) => {
        await patch(`/calls/${call.uid}/admit/${pid}`).catch(() => {});
        setWaiting(wp => wp.filter(p => p.peer_id !== pid));
    };

    const denyPeer = async (pid: string) => {
        await patch(`/calls/${call.uid}/kick/${pid}`).catch(() => {});
        setWaiting(wp => wp.filter(p => p.peer_id !== pid));
    };

    const kickPeer = (pid: string) => patch(`/calls/${call.uid}/kick/${pid}`).catch(() => {});
    const mutePeer = (pid: string) => patch(`/calls/${call.uid}/mute/${pid}`).catch(() => {});

    const handleChangePriority = async (newPriority: string, note: string) => {
        await patch(`/calls/${call.uid}/priority`, { priority: newPriority, priority_note: note || undefined });
        setPriority(newPriority);
        setPriorityNote(note);
    };

    const leaveCall = async () => {
        stopAllTracks();
        await post(`/calls/${call.uid}/leave`, { peer_id }).catch(() => {});
        doCleanup();
        setEndReason('left');
    };

    const endForAll = async () => {
        stopAllTracks();
        await patch(`/calls/${call.uid}/end`).catch(() => {});
        doCleanup();
        setEndReason('left');
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (endReason) return <EndScreen name={display_name} reason={endReason} />;

    const allPeers = Array.from(peers.values());
    const total    = allPeers.length + 1;
    const prUi     = PRIORITY_UI[priority] ?? PRIORITY_UI.routine;
    const PrIcon   = prUi.icon;

    const localPeer: Peer = {
        peer_id, display_name, role: is_host ? 'host' : 'participant',
        audio_on: audioOn, speaking: localSpeak, hand_raised: handRaised,
    };

    return (
        <div className="relative flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
            <Head title={call.title} />

            {/* Priority bar */}
            <div className={`h-1 w-full shrink-0 ${prUi.bar} ${priority === 'emergency' ? 'animate-pulse' : ''}`} />

            {!admitted && <WaitingOverlay callTitle={call.title} />}
            {is_host && call.waiting_room && (
                <AdmitPanel waiting={waiting} onAdmit={admitPeer} onDeny={denyPeer} />
            )}
            {hostDialog && (
                <HostLeaveDialog
                    onEndAll={() => { setHostDialog(false); endForAll(); }}
                    onLeaveOnly={() => { setHostDialog(false); leaveCall(); }}
                    onCancel={() => setHostDialog(false)}
                />
            )}
            {is_host && priorityPanel && (
                <PriorityPanel current={priority}
                    onClose={() => setPriorityPnl(false)}
                    onChangePriority={handleChangePriority}
                />
            )}

            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-2.5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                        <Phone className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{call.title}</p>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <Clock className="h-3 w-3" />{fmtTime(elapsed)}
                            <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${prUi.badge}">
                                <PrIcon className="h-2.5 w-2.5" />{prUi.label}
                            </span>
                            {waiting.length > 0 && (
                                <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400">
                                    {waiting.length} waiting
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Users className="h-3.5 w-3.5" />{total}
                </div>
            </header>

            {/* Priority note banner */}
            {priorityNote && (priority === 'urgent' || priority === 'emergency') && (
                <div className={`flex items-center gap-2 border-b px-4 py-2 text-xs
                    ${priority === 'emergency' ? 'border-red-800 bg-red-950/50 text-red-300' : 'border-orange-800 bg-orange-950/30 text-orange-300'}`}>
                    <PrIcon className="h-3.5 w-3.5 shrink-0" />
                    {priorityNote}
                </div>
            )}

            {/* Participants grid */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className={`grid gap-4 ${total <= 2 ? 'grid-cols-2 max-w-md mx-auto' : total <= 4 ? 'grid-cols-2 max-w-xl mx-auto' : 'grid-cols-3 max-w-2xl mx-auto'}`}>
                    <ParticipantTile peer={localPeer} local />
                    {allPeers.map(p => (
                        <ParticipantTile key={p.peer_id} peer={p}
                            onKick={is_host && p.role !== 'host' ? () => kickPeer(p.peer_id) : undefined}
                            onMute={is_host && p.role !== 'host' ? () => mutePeer(p.peer_id) : undefined}
                        />
                    ))}
                </div>

                {/* Participants panel */}
                {panelOpen && (
                    <div className="fixed right-4 top-20 z-20 w-56 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                            <p className="text-sm font-semibold">People ({total})</p>
                            <button onClick={() => setPanelOpen(false)} className="text-zinc-500 hover:text-white transition"><X className="h-4 w-4" /></button>
                        </div>
                        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                            <div className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-3 py-2 text-xs">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${localSpeak ? 'bg-green-500' : 'bg-primary/30'}`}>
                                    {display_name[0].toUpperCase()}
                                </div>
                                <span className="flex-1 truncate font-medium text-zinc-200">{display_name} (You)</span>
                                {!audioOn && <MicOff className="h-3 w-3 text-red-400" />}
                                {is_host && <Shield className="h-3 w-3 text-primary" />}
                            </div>
                            {allPeers.map(p => (
                                <div key={p.peer_id} className="group flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-zinc-800/50 transition">
                                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${p.speaking ? 'bg-green-500' : 'bg-zinc-700'}`}>
                                        {p.display_name[0].toUpperCase()}
                                    </div>
                                    <span className="flex-1 truncate text-zinc-300">{p.display_name}</span>
                                    <div className="flex items-center gap-1">
                                        {!p.audio_on && <MicOff className="h-3 w-3 text-red-400" />}
                                        {p.role === 'host' && <Shield className="h-3 w-3 text-primary" />}
                                        {is_host && p.role !== 'host' && (
                                            <button onClick={() => kickPeer(p.peer_id)}
                                                className="ml-0.5 hidden rounded p-0.5 text-zinc-500 hover:bg-red-600/20 hover:text-red-400 group-hover:block transition">
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
            <footer className="flex shrink-0 items-center justify-center gap-3 border-t border-zinc-800 py-4">
                {/* Mute */}
                <button onClick={toggleAudio} title={audioOn ? 'Mute' : 'Unmute'}
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition ${audioOn ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-500'}`}>
                    {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>

                {/* Raise hand */}
                <button onClick={toggleHand}
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition ${handRaised ? 'bg-yellow-500 ring-2 ring-yellow-400/40 hover:bg-yellow-400' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                    <Hand className="h-5 w-5" />
                </button>

                {/* Participants */}
                <button onClick={() => setPanelOpen(p => !p)}
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition ${panelOpen ? 'bg-primary ring-2 ring-primary/30' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                    <Users className="h-5 w-5" />
                </button>

                {/* Priority (host only) */}
                {is_host && (
                    <button onClick={() => setPriorityPnl(p => !p)} title="Change priority"
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition ${priorityPanel ? `${prUi.bar} opacity-100` : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        <PrIcon className="h-5 w-5" />
                    </button>
                )}

                {/* Leave / End */}
                <button onClick={() => is_host ? setHostDialog(true) : leaveCall()}
                    className="flex h-12 w-14 items-center justify-center rounded-full bg-red-600 transition hover:bg-red-500">
                    <PhoneOff className="h-5 w-5" />
                </button>
            </footer>
        </div>
    );
}
