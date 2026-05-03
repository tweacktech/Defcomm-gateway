/**
 * useWebRTC — mesh topology, N participants, screen sharing
 *
 * Architecture: Full mesh — every peer holds one RTCPeerConnection per
 * remote participant. When a new peer joins, *they* send offers to every
 * existing peer (late-joiner initiates). Screen sharing replaces the
 * existing video sender track via replaceTrack() — no renegotiation needed.
 *
 * Modified for Laravel Reverb: Uses Laravel Echo for signaling instead of raw Socket.IO
 */

import { useRef, useState, useCallback, useEffect } from "react";
import Echo from 'laravel-echo';
import type { ConnectionState, PeerInfo } from "../types";

// Laravel Reverb configuration
const REVERB_CONFIG = {
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY || 'your-app-key',
    wsHost: import.meta.env.VITE_REVERB_HOST || 'localhost',
    wsPort: import.meta.env.VITE_REVERB_PORT || 8080,
    wsScheme: import.meta.env.VITE_REVERB_SCHEME || 'http',
    forceTLS: false,
    enabledTransports: ['ws', 'wss'],
};

function makeRoomId(): string {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── hook return type ─────────────────────────────────────────────────────────

export interface UseWebRTCReturn {
    // local
    localStream: MediaStream | null;
    screenStream: MediaStream | null;
    isScreenSharing: boolean;
    // peers
    peers: Map<string, PeerInfo>;
    // room
    connectionState: ConnectionState;
    roomId: string;
    isInRoom: boolean;
    // controls
    isMuted: boolean;
    isCameraOff: boolean;
    error: string | null;
    iceStates: Map<string, string>;
    // actions
    joinRoom: (id?: string, name?: string) => Promise<void>;
    leaveRoom: () => void;
    toggleMute: () => void;
    toggleCamera: () => void;
    startScreenShare: () => Promise<void>;
    stopScreenShare: () => void;
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useWebRTC(): UseWebRTCReturn {
    // ── React state (UI) ────────────────────────────────────────────────────
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());
    const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
    const [roomId, setRoomId] = useState("");
    const [isInRoom, setIsInRoom] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [iceStates, setIceStates] = useState<Map<string, string>>(new Map());

    // ── Mutable refs (never stale inside callbacks) ──────────────────────────
    const echoRef           = useRef<Echo | null>(null);
    const channelRef        = useRef<any>(null);
    const localStreamRef    = useRef<MediaStream | null>(null);
    const screenStreamRef   = useRef<MediaStream | null>(null);
    const pcsRef            = useRef<Map<string, RTCPeerConnection>>(new Map());
    const peersRef          = useRef<Map<string, PeerInfo>>(new Map());
    const iceBufRef         = useRef<Map<string, RTCIceCandidate[]>>(new Map());
    const negotiatingRef    = useRef<Set<string>>(new Set());
    const mediaReadyRef     = useRef<Promise<MediaStream | null> | null>(null);
    const myNameRef         = useRef<string>("You");
    const myPeerIdRef       = useRef<string>("");
    const isMutedRef        = useRef(false);
    const isCameraOffRef    = useRef(false);
    const currentRoomIdRef  = useRef<string>("");

    // keep mutable refs in sync with state
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isCameraOffRef.current = isCameraOff; }, [isCameraOff]);

    // ── helpers ──────────────────────────────────────────────────────────────

    const commitPeers = useCallback(() => {
        setPeers(new Map(peersRef.current));
    }, []);

    const setIceState = useCallback((pid: string, state: string) => {
        setIceStates(prev => { const n = new Map(prev); n.set(pid, state); return n; });
    }, []);

    // ── ICE servers ───────────────────────────────────────────────────────────

    const getIceServers = useCallback(async (): Promise<RTCIceServer[]> => {
        // For Laravel development, use STUN/TURN from your Laravel backend
        try {
            const response = await fetch('/api/turn-credentials');
            const data = await response.json();
            return data.iceServers;
        } catch {
            // Use public STUN servers for development
            return [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
            ];
        }
    }, []);

    // ── Media ─────────────────────────────────────────────────────────────────

    const startMedia = useCallback(async (): Promise<MediaStream | null> => {
        if (localStreamRef.current) return localStreamRef.current;
        if (mediaReadyRef.current) return mediaReadyRef.current;

        mediaReadyRef.current = (async () => {
            try {
                const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = s;
                setLocalStream(s);
                return s;
            } catch {
                try {
                    const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    localStreamRef.current = s;
                    setLocalStream(s);
                    return s;
                } catch (e: any) {
                    setError(`Media error: ${e.message}`);
                    return null;
                }
            }
        })();

        return mediaReadyRef.current;
    }, []);

    // ── flush buffered ICE ────────────────────────────────────────────────────

    const flushIce = useCallback(async (pid: string, pc: RTCPeerConnection) => {
        const buf = iceBufRef.current.get(pid) ?? [];
        iceBufRef.current.delete(pid);
        for (const c of buf) {
            await pc.addIceCandidate(c).catch(() => { });
        }
    }, []);

    // ── build one RTCPeerConnection ───────────────────────────────────────────

    const buildPC = useCallback(async (remotePeerId: string): Promise<RTCPeerConnection> => {
        // close zombie
        const old = pcsRef.current.get(remotePeerId);
        if (old) { old.onicecandidate = null; old.ontrack = null; old.close(); }

        // media MUST exist before we add tracks / create offer
        const stream = localStreamRef.current ?? await startMedia();

        const iceServers = await getIceServers();
        const pc = new RTCPeerConnection({ iceServers });
        pcsRef.current.set(remotePeerId, pc);

        // add local camera/mic tracks
        if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));

        // if screen share is active, also add screen track
        if (screenStreamRef.current) {
            const screenTrack = screenStreamRef.current.getVideoTracks()[0];
            if (screenTrack) pc.addTrack(screenTrack, screenStreamRef.current);
        }

        // trickle ICE
        pc.onicecandidate = ({ candidate }) => {
            if (candidate && channelRef.current) {
                channelRef.current.whisper('ice-candidate', {
                    to: remotePeerId,
                    candidate
                });
            }
        };

        // ICE state
        pc.oniceconnectionstatechange = () => {
            setIceState(remotePeerId, pc.iceConnectionState);
            if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                setConnectionState("connected");
            } else if (pc.iceConnectionState === "failed") {
                pc.restartIce();
            }
        };

        // remote tracks arrive
        pc.ontrack = ({ streams, track }) => {
            const remote = streams[0] ?? new MediaStream([track]);
            const info = peersRef.current.get(remotePeerId);
            if (!info) return;

            if (track.kind === "video" && track.label?.includes("screen")) {
                peersRef.current.set(remotePeerId, { ...info, screenStream: remote, isScreenSharing: true });
            } else {
                peersRef.current.set(remotePeerId, { ...info, stream: remote });
            }
            commitPeers();
        };

        // negotiation needed lock
        pc.onnegotiationneeded = async () => {
            if (pc.signalingState !== "stable") return;
            if (negotiatingRef.current.has(remotePeerId)) return;
            negotiatingRef.current.add(remotePeerId);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                channelRef.current?.whisper('offer', {
                    to: remotePeerId,
                    offer: pc.localDescription
                });
            } catch (e) {
                console.warn("[pc] renegotiation failed", e);
            } finally {
                negotiatingRef.current.delete(remotePeerId);
            }
        };

        return pc;
    }, [getIceServers, startMedia, commitPeers, setIceState]);

    // ── send offer (we initiate) ──────────────────────────────────────────────

    const sendOffer = useCallback(async (remotePeerId: string) => {
        negotiatingRef.current.add(remotePeerId);
        try {
            const pc = await buildPC(remotePeerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channelRef.current?.whisper('offer', {
                to: remotePeerId,
                offer: pc.localDescription
            });
        } catch (e) {
            console.warn("[signal] sendOffer →", remotePeerId, e);
        } finally {
            negotiatingRef.current.delete(remotePeerId);
        }
    }, [buildPC]);

    // ── handle offer (remote initiated) ──────────────────────────────────────

    const handleOffer = useCallback(async (from: string, offer: RTCSessionDescriptionInit) => {
        const pc = await buildPC(from);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            await flushIce(from, pc);
            setTimeout(() => flushIce(from, pc), 600);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channelRef.current?.whisper('answer', {
                to: from,
                answer: pc.localDescription
            });
        } catch (e) {
            console.warn("[signal] handleOffer ←", from, e);
        }
    }, [buildPC, flushIce]);

    // ── handle answer ─────────────────────────────────────────────────────────

    const handleAnswer = useCallback(async (from: string, answer: RTCSessionDescriptionInit) => {
        const pc = pcsRef.current.get(from);
        if (!pc || pc.signalingState !== "have-local-offer") return;
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await flushIce(from, pc);
            setTimeout(() => flushIce(from, pc), 600);
        } catch (e) {
            console.warn("[signal] handleAnswer ←", from, e);
        }
    }, [flushIce]);

    // ── handle ICE ────────────────────────────────────────────────────────────

    const handleIce = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
        const pc = pcsRef.current.get(from);
        const c = new RTCIceCandidate(candidate);
        if (!pc?.remoteDescription) {
            const buf = iceBufRef.current.get(from) ?? [];
            buf.push(c);
            iceBufRef.current.set(from, buf);
        } else {
            await pc.addIceCandidate(c).catch(() => { });
        }
    }, []);

    // ── remove a peer cleanly ─────────────────────────────────────────────────

    const removePeer = useCallback((pid: string) => {
        const pc = pcsRef.current.get(pid);
        if (pc) { pc.onicecandidate = null; pc.ontrack = null; pc.close(); pcsRef.current.delete(pid); }
        iceBufRef.current.delete(pid);
        negotiatingRef.current.delete(pid);
        peersRef.current.delete(pid);
        commitPeers();
        setIceStates(prev => { const n = new Map(prev); n.delete(pid); return n; });
        if (peersRef.current.size === 0) setConnectionState("waiting");
    }, [commitPeers]);

    // ── Echo / Reverb setup ─────────────────────────────────────────────────────────

    const setupReverb = useCallback((roomId: string) => {
        if (echoRef.current) {
            echoRef.current.disconnect();
        }

        // Initialize Laravel Echo with Reverb
        echoRef.current = new Echo(REVERB_CONFIG);

        // Subscribe to the meeting channel
        channelRef.current = echoRef.current.join(`meet.${roomId}`);

        // Store our peer ID
        channelRef.current.here((users: any[]) => {
            myPeerIdRef.current = echoRef.current?.socketId() || '';

            // Register existing peers
            users.forEach((user: any) => {
                if (user.id !== myPeerIdRef.current) {
                    peersRef.current.set(user.id, {
                        peerId: user.id,
                        name: user.name || 'Peer',
                        stream: null,
                        screenStream: null,
                        audioOn: true,
                        videoOn: true,
                        isScreenSharing: false
                    });
                }
            });
            commitPeers();
            setIsInRoom(true);
            setConnectionState(users.length > 1 ? "connecting" : "waiting");

            // Send offers to existing peers
            users.forEach((user: any) => {
                if (user.id !== myPeerIdRef.current) {
                    sendOffer(user.id);
                }
            });
        });

        // New peer joins
        channelRef.current.joining((user: any) => {
            if (user.id !== myPeerIdRef.current && !peersRef.current.has(user.id)) {
                peersRef.current.set(user.id, {
                    peerId: user.id,
                    name: user.name || 'Peer',
                    stream: null,
                    screenStream: null,
                    audioOn: true,
                    videoOn: true,
                    isScreenSharing: false
                });
                commitPeers();
                setConnectionState("connecting");
                sendOffer(user.id);
            }
        });

        // Peer leaves
        channelRef.current.leaving((user: any) => {
            removePeer(user.id);
        });

        // Whisper events for WebRTC signaling
        channelRef.current.listenForWhisper('offer', (e: any) => {
            if (e.from !== myPeerIdRef.current) {
                handleOffer(e.from, e.offer);
            }
        });

        channelRef.current.listenForWhisper('answer', (e: any) => {
            if (e.from !== myPeerIdRef.current) {
                handleAnswer(e.from, e.answer);
            }
        });

        channelRef.current.listenForWhisper('ice-candidate', (e: any) => {
            if (e.from !== myPeerIdRef.current) {
                handleIce(e.from, e.candidate);
            }
        });

        channelRef.current.listenForWhisper('media-state', (e: any) => {
            if (e.from !== myPeerIdRef.current) {
                const info = peersRef.current.get(e.from);
                if (info) {
                    peersRef.current.set(e.from, {
                        ...info,
                        audioOn: e.audioOn,
                        videoOn: e.videoOn,
                        isScreenSharing: e.isScreenSharing
                    });
                    commitPeers();
                }
            }
        });

        channelRef.current.error((err: any) => {
            setError(`Channel error: ${err.message}`);
            setConnectionState("error");
        });
    }, [sendOffer, handleOffer, handleAnswer, handleIce, removePeer, commitPeers]);

    // ── broadcast our media state to everyone ─────────────────────────────────

    const broadcastMediaState = useCallback((overrides: Partial<{ audioOn: boolean; videoOn: boolean; isScreenSharing: boolean }> = {}) => {
        if (channelRef.current) {
            channelRef.current.whisper('media-state', {
                from: myPeerIdRef.current,
                audioOn: overrides.audioOn ?? !isMutedRef.current,
                videoOn: overrides.videoOn ?? !isCameraOffRef.current,
                isScreenSharing: overrides.isScreenSharing ?? !!screenStreamRef.current,
            });
        }
    }, []);

    // ── join room ─────────────────────────────────────────────────────────────

    const joinRoom = useCallback(async (id?: string, name = "You") => {
        setError(null);
        myNameRef.current = name;
        const rid = id?.trim().toUpperCase() || makeRoomId();
        setRoomId(rid);
        currentRoomIdRef.current = rid;
        setConnectionState("connecting");

        await startMedia();

        // The Reverb connection and channel subscription
        setupReverb(rid);
    }, [startMedia, setupReverb]);

    // ── leave room ────────────────────────────────────────────────────────────

    const leaveRoom = useCallback(() => {
        if (channelRef.current) {
            channelRef.current.leave();
            channelRef.current = null;
        }

        if (echoRef.current) {
            echoRef.current.disconnect();
            echoRef.current = null;
        }

        pcsRef.current.forEach(pc => { pc.onicecandidate = null; pc.ontrack = null; pc.close(); });
        pcsRef.current.clear();
        negotiatingRef.current.clear();
        iceBufRef.current.clear();

        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        mediaReadyRef.current = null;

        peersRef.current.clear();
        setPeers(new Map());
        setLocalStream(null);
        setScreenStream(null);
        setIsScreenSharing(false);
        setIsInRoom(false);
        setConnectionState("idle");
        setIceStates(new Map());
        setIsMuted(false);
        setIsCameraOff(false);
        setError(null);
    }, []);

    // ── toggle mute ───────────────────────────────────────────────────────────

    const toggleMute = useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream) return;
        const next = !isMutedRef.current;
        stream.getAudioTracks().forEach(t => (t.enabled = !next));
        setIsMuted(next);
        broadcastMediaState({ audioOn: !next });
    }, [broadcastMediaState]);

    // ── toggle camera ─────────────────────────────────────────────────────────

    const toggleCamera = useCallback(() => {
        const stream = localStreamRef.current;
        if (!stream) return;
        const next = !isCameraOffRef.current;
        stream.getVideoTracks().forEach(t => (t.enabled = !next));
        setIsCameraOff(next);
        broadcastMediaState({ videoOn: !next });
    }, [broadcastMediaState]);

    // ── screen sharing ────────────────────────────────────────────────────────

    const startScreenShare = useCallback(async () => {
        try {
            const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            const screenTrack = ss.getVideoTracks()[0];
            screenStreamRef.current = ss;
            setScreenStream(ss);
            setIsScreenSharing(true);

            // Replace or add video track on every PC
            pcsRef.current.forEach(async (pc, remotePeerId) => {
                const sender = pc.getSenders().find(s => s.track?.kind === "video");
                if (sender) {
                    await sender.replaceTrack(screenTrack);
                } else {
                    if (negotiatingRef.current.has(remotePeerId)) return;
                    negotiatingRef.current.add(remotePeerId);
                    try {
                        pc.addTrack(screenTrack, ss);
                        if (pc.signalingState === "stable") {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            channelRef.current?.whisper('offer', {
                                to: remotePeerId,
                                offer: pc.localDescription
                            });
                        }
                    } finally {
                        negotiatingRef.current.delete(remotePeerId);
                    }
                }
            });

            broadcastMediaState({ isScreenSharing: true });

            // Auto-stop when user clicks "Stop sharing" in browser chrome
            screenTrack.onended = () => stopScreenShare();
        } catch {
            // user cancelled
        }
    }, [broadcastMediaState]);

    const stopScreenShare = useCallback(() => {
        const ss = screenStreamRef.current;
        if (!ss) return;
        ss.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setScreenStream(null);
        setIsScreenSharing(false);

        // Restore camera track on every PC
        const camTrack = localStreamRef.current?.getVideoTracks()[0];
        pcsRef.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track?.kind === "video");
            if (sender && camTrack) {
                sender.replaceTrack(camTrack).catch(() => { });
            }
        });

        broadcastMediaState({ isScreenSharing: false });
    }, [broadcastMediaState]);

    // ── cleanup ───────────────────────────────────────────────────────────────

    useEffect(() => () => leaveRoom(), [leaveRoom]);

    return {
        localStream, screenStream, isScreenSharing,
        peers, connectionState, roomId, isInRoom,
        isMuted, isCameraOff, error, iceStates,
        joinRoom, leaveRoom,
        toggleMute, toggleCamera,
        startScreenShare, stopScreenShare,
    };
}
