// resources/js/pages/meet/room.tsx
// The actual call room — WebRTC peer mesh via Laravel Reverb signaling

import { Head, usePage, router } from '@inertiajs/react';
import {
    Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff,
    PhoneOff, Hand, MessageSquare, Users, MoreVertical,
    Copy, Check, Settings, Record, StopCircle, Shield,
    ChevronLeft, Globe, Clock, Maximize2,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomConfig {
    id: number;
    uid: string;
    name: string;
    status: string;
    has_password: boolean;
    video_enabled: boolean;
    audio_enabled: boolean;
    chat_enabled: boolean;
    screen_share_enabled: boolean;
    recording_enabled: boolean;
    waiting_room: boolean;
    join_url: string;
}

interface Peer {
    peer_id: string;
    display_name: string;
    role: string;
    video_on: boolean;
    audio_on: boolean;
    screen_sharing: boolean;
    hand_raised: boolean;
    stream?: MediaStream;
    connection?: RTCPeerConnection;
}

interface ChatMessage {
    id: string;
    peer_id: string;
    display_name: string;
    text: string;
    sent_at: string;
}

interface PageProps {
    room: RoomConfig;
    peer_id: string;
    is_owner: boolean;
    reverb_key: string;
    reverb_host: string;
    reverb_port: number;
    stun_servers: RTCIceServer[];
    auth: { user: { id: number; name: string } };
}

// ─── Tile component ────────────────────────────────────────────────────────────

function VideoTile({ peer, local = false }: { peer: Peer; local?: boolean }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream]);

    return (
        <div className="relative flex items-center justify-center overflow-hidden rounded-xl bg-zinc-900 aspect-video">
            {peer.video_on && peer.stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    muted={local}
                    playsInline
                    className="h-full w-full object-cover"
                />
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-700 text-2xl font-bold text-white">
                        {peer.display_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-zinc-400">{peer.display_name}</span>
                </div>
            )}

            {/* Name bar */}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
                {!peer.audio_on && <MicOff className="h-3 w-3 text-red-400" />}
                {peer.hand_raised && <Hand className="h-3 w-3 text-yellow-400" />}
                <span>{local ? `${peer.display_name} (You)` : peer.display_name}</span>
                {peer.role === 'host' && <Shield className="h-3 w-3 text-primary" />}
            </div>
        </div>
    );
}

// ─── Main Room Page ────────────────────────────────────────────────────────────

export default function MeetRoom() {
    const {
        room, peer_id, is_owner, reverb_key, reverb_host, reverb_port, stun_servers, auth,
    } = usePage<PageProps>().props;

    // ── Local state ─────────────────────────────────────────────────────────
    const [localStream, setLocalStream]       = useState<MediaStream | null>(null);
    const [peers, setPeers]                   = useState<Map<string, Peer>>(new Map());
    const [videoOn, setVideoOn]               = useState(room.video_enabled);
    const [audioOn, setAudioOn]               = useState(room.audio_enabled);
    const [screenSharing, setScreenSharing]   = useState(false);
    const [handRaised, setHandRaised]         = useState(false);
    const [chatOpen, setChatOpen]             = useState(false);
    const [participantsOpen, setParticipants] = useState(false);
    const [messages, setMessages]             = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput]           = useState('');
    const [joined, setJoined]                 = useState(false);
    const [urlCopied, setUrlCopied]           = useState(false);
    const [ended, setEnded]                   = useState(false);

    const echoRef    = useRef<Echo<any> | null>(null);
    const channelRef = useRef<any>(null);

    // ── Setup media ─────────────────────────────────────────────────────────
    const startLocalMedia = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: room.video_enabled,
                audio: room.audio_enabled,
            });
            setLocalStream(stream);
            return stream;
        } catch (e) {
            console.warn('Media access denied, joining audio-only or view-only');
            setVideoOn(false);
            return null;
        }
    }, [room.video_enabled, room.audio_enabled]);

    // ── Create peer connection ────────────────────────────────────────────────
    const createPeerConnection = useCallback((remotePeerId: string, stream: MediaStream | null) => {
        const pc = new RTCPeerConnection({ iceServers: stun_servers });

        // Add local tracks
        stream?.getTracks().forEach(track => pc.addTrack(track, stream));

        // ICE candidates → signal via server
        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                fetch(`/meet/${room.uid}/signal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ?? '' },
                    body: JSON.stringify({
                        to: remotePeerId,
                        type: 'ice-candidate',
                        payload: candidate,
                        from_peer_id: peer_id,
                    }),
                });
            }
        };

        // Remote track arrives
        pc.ontrack = ({ streams: [remoteStream] }) => {
            setPeers(prev => {
                const updated = new Map(prev);
                const peer = updated.get(remotePeerId);
                if (peer) updated.set(remotePeerId, { ...peer, stream: remoteStream });
                return updated;
            });
        };

        return pc;
    }, [room.uid, peer_id, stun_servers]);

    // ── Join room ─────────────────────────────────────────────────────────────
    const joinRoom = useCallback(async () => {
        const stream = await startLocalMedia();

        // Register with backend
        await fetch(`/meet/${room.uid}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ?? '' },
            body: JSON.stringify({
                peer_id,
                display_name: auth.user.name,
                video_on: videoOn,
                audio_on: audioOn,
            }),
        });

        // Init Echo + Reverb
        (window as any).Pusher = Pusher;
        const echo = new Echo({
            broadcaster: 'reverb',
            key: reverb_key,
            wsHost: reverb_host,
            wsPort: reverb_port,
            forceTLS: false,
            enabledTransports: ['ws', 'wss'],
        });
        echoRef.current = echo;

        const channel = echo.join(`meet.${room.uid}`);
        channelRef.current = channel;

        // ── Presence events ──────────────────────────────────────────────────
        channel.here((members: any[]) => {
            // Build initial peer map from presence members
            const map = new Map<string, Peer>();
            members.forEach(m => {
                if (m.peer_id !== peer_id) {
                    map.set(m.peer_id, {
                        peer_id: m.peer_id,
                        display_name: m.display_name ?? m.name,
                        role: m.role ?? 'participant',
                        video_on: false,
                        audio_on: false,
                        screen_sharing: false,
                        hand_raised: false,
                    });
                }
            });
            setPeers(map);
        });

        channel.joining(async (member: any) => {
            if (member.peer_id === peer_id) return;

            // Initiator: create offer for the new joiner
            const pc = createPeerConnection(member.peer_id, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            setPeers(prev => {
                const updated = new Map(prev);
                updated.set(member.peer_id, {
                    peer_id: member.peer_id,
                    display_name: member.display_name ?? member.name,
                    role: 'participant',
                    video_on: false,
                    audio_on: false,
                    screen_sharing: false,
                    hand_raised: false,
                    connection: pc,
                });
                return updated;
            });

            fetch(`/meet/${room.uid}/signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ?? '' },
                body: JSON.stringify({ to: member.peer_id, type: 'offer', payload: offer, from_peer_id: peer_id }),
            });
        });

        channel.leaving((member: any) => {
            setPeers(prev => {
                const updated = new Map(prev);
                const peer = updated.get(member.peer_id);
                peer?.connection?.close();
                updated.delete(member.peer_id);
                return updated;
            });
        });

        // ── WebRTC signal events ──────────────────────────────────────────────
        channel.listen('.meet.signal', async (data: any) => {
            if (data.to !== peer_id) return;

            const { from, type, payload } = data;


            if (type === 'offer') {
                const pc = createPeerConnection(from, stream);
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                setPeers(prev => {
                    const updated = new Map(prev);
                    const existing = updated.get(from);
                    if (existing) updated.set(from, { ...existing, connection: pc });
                    return updated;
                });

                fetch(`/meet/${room.uid}/signal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ?? '' },
                    body: JSON.stringify({ to: from, type: 'answer', payload: answer, from_peer_id: peer_id }),
                });
            }

            if (type === 'answer') {
                const pc = peers.get(from)?.connection;
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload));
            }

            if (type === 'ice-candidate') {
                const pc = peers.get(from)?.connection;
                if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload));
            }
        });

        // Room ended
        channel.listen('.meet.room-ended', () => {
            setEnded(true);
            setTimeout(() => router.get('/meet'), 3000);
        });

        setJoined(true);

    }, [room.uid, peer_id, auth.user?.name, videoOn, audioOn, startLocalMedia, createPeerConnection, peers, reverb_key, reverb_host, reverb_port]);

    // ── Leave ────────────────────────────────────────────────────────────────
    const leaveRoom = useCallback(async () => {
        localStream?.getTracks().forEach(t => t.stop());
        peers.forEach(p => p.connection?.close());
        echoRef.current?.leave(`meet.${room.uid}`);
        await fetch(`/meet/${room.uid}/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ?? '' },
            body: JSON.stringify({ peer_id }),
        });
        router.get('/meet');
    }, [localStream, peers, room.uid, peer_id]);

    // ── Controls ─────────────────────────────────────────────────────────────
    const toggleVideo = () => {
        localStream?.getVideoTracks().forEach(t => { t.enabled = !videoOn; });
        setVideoOn(v => !v);
    };

    const toggleAudio = () => {
        localStream?.getAudioTracks().forEach(t => { t.enabled = !audioOn; });
        setAudioOn(a => !a);
    };

    const toggleScreenShare = async () => {
        if (screenSharing) {
            localStream?.getVideoTracks().forEach(t => t.stop());
            setScreenSharing(false);
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack  = screenStream.getVideoTracks()[0];
                peers.forEach(p => {
                    if (p.connection) {
                        const sender = p.connection.getSenders().find(s => s.track?.kind === 'video');
                        sender?.replaceTrack(screenTrack);
                    }
                });
                screenTrack.onended = () => setScreenSharing(false);
                setScreenSharing(true);
            } catch { /* user cancelled */ }
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(room.join_url);
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
    };

    const endMeeting = async () => {
        await fetch(`/meet/${room.uid}/end`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ?? '' },
        });
        leaveRoom();
    };

    // ── Auto-join on mount ────────────────────────────────────────────────────
    useEffect(() => {
        joinRoom();
        return () => { localStream?.getTracks().forEach(t => t.stop()); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const allPeers = Array.from(peers.values());
    const gridCols = allPeers.length === 0 ? 'grid-cols-1'
                   : allPeers.length <= 2  ? 'grid-cols-2'
                   : allPeers.length <= 6  ? 'grid-cols-3'
                   : 'grid-cols-4';

    // ── Ended overlay ────────────────────────────────────────────────────────
    if (ended) return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-white">
            <PhoneOff className="h-12 w-12 text-red-400" />
            <p className="text-xl font-bold">Meeting ended</p>
            <p className="text-sm text-zinc-400">Redirecting you back…</p>
        </div>
    );

    return (
        <div className="flex h-screen flex-col bg-zinc-950 text-white overflow-hidden">
            <Head title={room.name} />

            {/* ── Header ─────────────────────────────────────────────────── */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.get('/meet')}
                        className="rounded-lg p-1.5 hover:bg-zinc-800 transition">
                        <ChevronLeft className="h-4 w-4 text-zinc-400" />
                    </button>
                    <div>
                        <p className="text-sm font-semibold">{room.name}</p>
                        <p className="text-xs text-zinc-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {allPeers.length + 1} participant{allPeers.length !== 0 ? 's' : ''}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={copyLink}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800 transition">
                        {urlCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        {urlCopied ? 'Copied!' : 'Copy invite'}
                    </button>
                    <div className="flex items-center gap-1 rounded-lg bg-green-500/10 px-2.5 py-1.5 text-xs text-green-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        Live
                    </div>
                </div>
            </header>

            {/* ── Video grid ────────────────────────────────────────────── */}
            <main className="flex flex-1 gap-2 overflow-hidden p-3">
                <div className={`grid ${gridCols} gap-2 flex-1 content-start`}>
                    {/* Local tile */}
                    {localStream && (
                        <VideoTile
                            local
                            peer={{
                                peer_id,
                                display_name: auth.user?.name || 'You',
                                role: is_owner ? 'host' : 'participant',
                                video_on: videoOn,
                                audio_on: audioOn,
                                screen_sharing: screenSharing,
                                hand_raised: handRaised,
                                stream: localStream,
                            }}
                        />
                    )}
                    {/* Remote tiles */}
                    {allPeers.map(peer => (
                        <VideoTile key={peer.peer_id} peer={peer} />
                    ))}
                </div>

                {/* ── Chat panel ──────────────────────────────────────── */}
                {chatOpen && room.chat_enabled && (
                    <div className="w-72 flex flex-col rounded-xl border border-zinc-800 bg-zinc-900">
                        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                            <p className="text-sm font-semibold">Chat</p>
                            <button onClick={() => setChatOpen(false)} className="text-zinc-500 hover:text-white">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {messages.map(m => (
                                <div key={m.id} className="text-xs">
                                    <span className="font-medium text-zinc-300">{m.display_name}: </span>
                                    <span className="text-zinc-400">{m.text}</span>
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <p className="text-center text-xs text-zinc-600">No messages yet</p>
                            )}
                        </div>
                        <div className="border-t border-zinc-800 p-3 flex gap-2">
                            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                                placeholder="Type a message…"
                                className="flex-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && chatInput.trim()) {
                                        channelRef.current?.whisper('chat', { peer_id, display_name: auth.user.name, text: chatInput.trim(), id: crypto.randomUUID(), sent_at: new Date().toISOString() });
                                        setMessages(m => [...m, { id: crypto.randomUUID(), peer_id, display_name: 'You', text: chatInput, sent_at: new Date().toISOString() }]);
                                        setChatInput('');
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </main>

            {/* ── Controls bar ──────────────────────────────────────────── */}
            <footer className="flex items-center justify-center gap-3 border-t border-zinc-800 py-4">
                {/* Mic */}
                <button onClick={toggleAudio}
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition ${audioOn ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-500'}`}>
                    {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>

                {/* Camera */}
                {room.video_enabled && (
                    <button onClick={toggleVideo}
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition ${videoOn ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-red-600 hover:bg-red-500'}`}>
                        {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </button>
                )}

                {/* Screen share */}
                {room.screen_share_enabled && (
                    <button onClick={toggleScreenShare}
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition ${screenSharing ? 'bg-green-600 hover:bg-green-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        {screenSharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
                    </button>
                )}

                {/* Hand raise */}
                <button onClick={() => setHandRaised(h => !h)}
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition ${handRaised ? 'bg-yellow-500 hover:bg-yellow-400' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                    <Hand className="h-5 w-5" />
                </button>

                {/* Chat */}
                {room.chat_enabled && (
                    <button onClick={() => setChatOpen(c => !c)}
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition ${chatOpen ? 'bg-primary' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                        <MessageSquare className="h-5 w-5" />
                    </button>
                )}

                {/* Participants */}
                <button onClick={() => setParticipants(p => !p)}
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition ${participantsOpen ? 'bg-primary' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                    <Users className="h-5 w-5" />
                </button>

                {/* End call */}
                <button onClick={is_owner ? endMeeting : leaveRoom}
                    className="flex h-12 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-500 transition">
                    <PhoneOff className="h-5 w-5" />
                </button>
            </footer>
        </div>
    );
}
