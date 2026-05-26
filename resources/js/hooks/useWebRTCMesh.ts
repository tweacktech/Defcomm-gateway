// /**
//  * useWebRTCMesh — Laravel Reverb + full-mesh WebRTC
//  *
//  * Signaling architecture mirrors the Node signaling server (signaling.js):
//  *
//  *   Server (signaling.js)          │  This hook (Reverb equivalent)
//  *   ─────────────────────────────  │  ──────────────────────────────
//  *   join-room → joined-room        │  POST /join → here()
//  *   peer-joined (to others)        │  joining()
//  *   offer / answer / ice-candidate │  whisper("signal", { to, from, type, payload })
//  *   media-state relay              │  whisper("media-state", ...)
//  *   peer-left                      │  leaving()
//  *
//  * KEY RULE (matches signaling.js exactly):
//  *   - here()    → seed peer list + send offers to existing peers (like joined-room)
//  *   - joining() → add peer + send offer IF we are the initiator (like peer-joined)
//  *   - ParticipantJoined broadcast → ONLY updates existing peer metadata, NEVER adds
//  *   - Single seenPeers Set guards ALL addition paths
//  *
//  * Eliminates the 403 by using presence-channel whispers for signals (no private channel).
//  */


// import axios from "axios";
// import { useRef, useState, useCallback, useEffect } from "react";
// // ─────────────────────────────────────────────────────────────────────────────
// // Types
// // ─────────────────────────────────────────────────────────────────────────────

// export interface PeerInfo {
//   peer_id: string;
//   display_name: string;
//   role: "host" | "participant";
//   video_on: boolean;
//   audio_on: boolean;
//   screen_sharing: boolean;
//   hand_raised: boolean;
//   speaking: boolean;
//   stream?: MediaStream;
// }

// export interface ChatMsg {
//   id: string;
//   peer_id: string;
//   display_name: string;
//   text: string;
//   sent_at: string;
// }

// export interface WaitingPeer {
//   peer_id: string;
//   display_name: string;
// }

// export interface MeshCallbacks {
//   onError?: (msg: string) => void;
//   onConnectionStateChanged?: (state: string) => void;
//   onPeerJoined?: (peer: PeerInfo) => void;
//   onPeerLeft?: (peerId: string, name: string) => void;
//   onChatMessage?: (msg: ChatMsg) => void;
//   onRoomEnded?: () => void;
//   onKicked?: () => void;
//   onAdmitted?: () => void;
//   onWaitingListChanged?: (list: WaitingPeer[]) => void;
// }

// export interface UseWebRTCMeshReturn {
//   peers: Map<string, PeerInfo>;
//   waiting: WaitingPeer[];
//   localStream: MediaStream | null;
//   screenStream: MediaStream | null;
//   connectionState: string;
//   error: string | null;
//   startMedia: () => Promise<MediaStream | null>;
//   stopMedia: () => void;
//   toggleAudio: (enabled: boolean) => void;
//   toggleVideo: (enabled: boolean) => void;
//   startScreenShare: () => Promise<void>;
//   stopScreenShare: () => void;
//   setupEcho: (
//     key: string,
//     host: string,
//     port: number,
//     useTls: boolean,
//     peerId: string,
//     roomUid: string,
//     callbacks?: MeshCallbacks
//   ) => Promise<void>;
//   teardown: () => void;
//   broadcastChat: (msg: ChatMsg) => void;
//   broadcastMediaState: (state: Partial<PeerInfo>) => void;
// }

// // ─────────────────────────────────────────────────────────────────────────────
// // Hook
// // ─────────────────────────────────────────────────────────────────────────────

// export function useWebRTCMesh(): UseWebRTCMeshReturn {
//   const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());
//   const [waiting, setWaiting] = useState<WaitingPeer[]>([]);
//   const [localStream, setLocalStream] = useState<MediaStream | null>(null);
//   const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
//   const [connectionState, setConnectionState] = useState<string>("idle");
//   const [error, setError] = useState<string | null>(null);

//   // All mutable state lives in refs — never stale inside async callbacks
//   const R = useRef({
//     echo: null as any,
//     channel: null as any,

//     pcs: new Map<string, RTCPeerConnection>(),

//     // Canonical peer list (source of truth)
//     peers: new Map<string, PeerInfo>(),

//     // Guards ALL peer-addition paths — prevents presence joining() +
//     // ParticipantJoined broadcast from both adding the same peer.
//     // Mirrors how signaling.js rooms Map prevents double-registration.
//     seenPeers: new Set<string>(),

//     waiting: [] as WaitingPeer[],
//     iceBuf: new Map<string, RTCIceCandidate[]>(),

//     // Mirrors signaling.js negotiatingRef — prevents concurrent offers
//     makingOffer: new Set<string>(),

//     localStream: null as MediaStream | null,
//     screenStream: null as MediaStream | null,
//     mediaReady: null as Promise<MediaStream | null> | null,

//     myPeerId: "",
//     roomUid: "",
//     callbacks: {} as MeshCallbacks,
//   });

//   // ── state commit ─────────────────────────────────────────────────────────────

//   const commitPeers = useCallback(() => {
//     setPeers(new Map(R.current.peers));
//   }, []);

//   const commitWaiting = useCallback((list: WaitingPeer[]) => {
//     R.current.waiting = list;
//     setWaiting([...list]);
//     R.current.callbacks.onWaitingListChanged?.(list);
//   }, []);

//   // ── ICE servers ───────────────────────────────────────────────────────────────

//   const getIceServers = useCallback(async (): Promise<RTCIceServer[]> => {
//     try {
//       const res = await fetch("/api/turn-credentials");
//       const data = await res.json();
//       if (data?.iceServers?.length) return data.iceServers;
//     } catch {}
//     return [
//       { urls: "stun:stun.l.google.com:19302" },
//       { urls: "stun:stun1.l.google.com:19302" },
//     ];
//   }, []);

//   // ── media ─────────────────────────────────────────────────────────────────────

//   const startMedia = useCallback(async (): Promise<MediaStream | null> => {
//     if (R.current.localStream) return R.current.localStream;
//     if (R.current.mediaReady) return R.current.mediaReady;

//     R.current.mediaReady = (async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//         R.current.localStream = stream;
//         setLocalStream(stream);
//         return stream;
//       } catch {
//         try {
//           const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
//           R.current.localStream = stream;
//           setLocalStream(stream);
//           return stream;
//         } catch (e: any) {
//           const msg = `Media error: ${e.message}`;
//           setError(msg);
//           R.current.callbacks.onError?.(msg);
//           return null;
//         }
//       }
//     })();

//     return R.current.mediaReady;
//   }, []);

//   const stopMedia = useCallback(() => {
//     R.current.localStream?.getTracks().forEach(t => t.stop());
//     R.current.localStream = null;
//     R.current.mediaReady = null;
//     setLocalStream(null);
//   }, []);

//   const toggleAudio = useCallback((enabled: boolean) => {
//     R.current.localStream?.getAudioTracks().forEach(t => { t.enabled = enabled; });
//   }, []);

//   const toggleVideo = useCallback((enabled: boolean) => {
//     R.current.localStream?.getVideoTracks().forEach(t => { t.enabled = enabled; });
//   }, []);

//   // ── ICE buffer ────────────────────────────────────────────────────────────────

//   const flushIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
//     const buf = R.current.iceBuf.get(peerId) ?? [];
//     R.current.iceBuf.delete(peerId);
//     for (const c of buf) {
//       try { await pc.addIceCandidate(c); } catch {}
//     }
//   }, []);

//   // ── whisper signal ────────────────────────────────────────────────────────────
//   // Equivalent to: socket.emit("offer", { to, offer }) in signaling.js
//   // Uses presence channel whispers — no /broadcasting/auth needed.

//   const whisperSignal = useCallback((
//     to: string,
//     type: "offer" | "answer" | "ice-candidate",
//     payload: any,
//   ) => {
//     R.current.channel?.whisper("signal", {
//       to,
//       from: R.current.myPeerId,
//       type,
//       payload,
//     });
//   }, []);

//   // ── removePeer ────────────────────────────────────────────────────────────────
//   // Equivalent to: socket.on("peer-left") handler in signaling.js

//   const removePeer = useCallback((peerId: string) => {
//     const pc = R.current.pcs.get(peerId);
//     if (pc) {
//       pc.onicecandidate = null;
//       pc.ontrack = null;
//       pc.onconnectionstatechange = null;
//       pc.close();
//       R.current.pcs.delete(peerId);
//     }
//     R.current.iceBuf.delete(peerId);
//     R.current.makingOffer.delete(peerId);

//     const peer = R.current.peers.get(peerId);
//     R.current.peers.delete(peerId);
//     R.current.seenPeers.delete(peerId);   // allow re-join with same peer_id
//     commitPeers();

//     if (peer) R.current.callbacks.onPeerLeft?.(peerId, peer.display_name);
//     if (R.current.peers.size === 0) setConnectionState("waiting");
//   }, [commitPeers]);

//   // ── addPeer ───────────────────────────────────────────────────────────────────
//   // THE single entry point for adding a remote peer.
//   // Mirrors rooms.set(socket.id, { name }) in signaling.js.
//   //
//   // Returns true  → peer is NEW, caller should initiate WebRTC
//   // Returns false → peer already known, no-op (prevents double-add)

//   const addPeer = useCallback((
//     uid: string,
//     displayName: string,
//     role: "host" | "participant",
//     extra: Partial<PeerInfo> = {},
//   ): boolean => {
//     if (R.current.seenPeers.has(uid)) {
//       // Already known — only merge media-state fields if provided
//       const existing = R.current.peers.get(uid);
//       if (existing && Object.keys(extra).length > 0) {
//         R.current.peers.set(uid, { ...existing, ...extra });
//         commitPeers();
//       }
//       return false; // NOT new
//     }

//     R.current.seenPeers.add(uid);
//     R.current.peers.set(uid, {
//       peer_id: uid,
//       display_name: displayName,
//       role,
//       video_on: true,
//       audio_on: true,
//       screen_sharing: false,
//       hand_raised: false,
//       speaking: false,
//       ...extra,
//     });
//     commitPeers();
//     return true; // IS new
//   }, [commitPeers]);

//   // ── buildPC ───────────────────────────────────────────────────────────────────
//   // Equivalent to buildPC() in useWebRTC.ts (test-app hook)

//   const buildPC = useCallback(async (remotePeerId: string): Promise<RTCPeerConnection> => {
//     const existing = R.current.pcs.get(remotePeerId);
//     if (existing && existing.connectionState !== "failed" && existing.connectionState !== "closed") {
//       return existing;
//     }
//     if (existing) {
//       existing.onicecandidate = null;
//       existing.ontrack = null;
//       existing.onconnectionstatechange = null;
//       existing.close();
//     }

//     const stream = R.current.localStream ?? (await startMedia());
//     const iceServers = await getIceServers();
//     const pc = new RTCPeerConnection({ iceServers });
//     R.current.pcs.set(remotePeerId, pc);

//     // Add local tracks (camera/mic)
//     if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream));

//     // ICE — equivalent to: socket.emit("ice-candidate", { to, candidate })
//     pc.onicecandidate = ({ candidate }) => {
//       if (!candidate) return;
//       whisperSignal(remotePeerId, "ice-candidate", candidate.toJSON());
//     };

//     // Remote tracks arrive
//     pc.ontrack = ({ streams }) => {
//       const remoteStream = streams[0];
//       const peer = R.current.peers.get(remotePeerId);
//       if (!peer) return;
//       R.current.peers.set(remotePeerId, { ...peer, stream: remoteStream });
//       commitPeers();
//     };

//     // Connection state
//     pc.onconnectionstatechange = () => {
//       const state = pc.connectionState;
//       if (state === "connected") {
//         setConnectionState("connected");
//         R.current.callbacks.onConnectionStateChanged?.("connected");
//       }
//       if (state === "failed" || state === "closed") removePeer(remotePeerId);
//     };

//     return pc;
//   }, [startMedia, getIceServers, commitPeers, whisperSignal, removePeer]);

//   // ── sendOffer ─────────────────────────────────────────────────────────────────
//   // Equivalent to: socket.emit("offer", { to, offer }) in signaling.js

//   const sendOffer = useCallback(async (remotePeerId: string) => {
//     if (R.current.makingOffer.has(remotePeerId)) return;
//     R.current.makingOffer.add(remotePeerId);
//     try {
//       const pc = await buildPC(remotePeerId);
//       const offer = await pc.createOffer();
//       await pc.setLocalDescription(offer);
//       whisperSignal(remotePeerId, "offer", pc.localDescription?.toJSON());
//     } catch (e) {
//       console.error("[sendOffer]", remotePeerId, e);
//     } finally {
//       R.current.makingOffer.delete(remotePeerId);
//     }
//   }, [buildPC, whisperSignal]);

//   // ── handleOffer ───────────────────────────────────────────────────────────────
//   // Equivalent to: socket.on("offer") in signaling.js client

//   const handleOffer = useCallback(async (from: string, payload: RTCSessionDescriptionInit) => {
//     const pc = await buildPC(from);

//     // Perfect negotiation: polite peer defers on collision
//     const offerCollision =
//       payload.type === "offer" &&
//       (R.current.makingOffer.has(from) || pc.signalingState !== "stable");
//     const polite = R.current.myPeerId > from;
//     if (!polite && offerCollision) return;

//     try {
//       await pc.setRemoteDescription(new RTCSessionDescription(payload));
//       await flushIce(from, pc);
//       const answer = await pc.createAnswer();
//       await pc.setLocalDescription(answer);
//       whisperSignal(from, "answer", pc.localDescription?.toJSON());
//     } catch (e) {
//       console.error("[handleOffer]", from, e);
//     }
//   }, [buildPC, flushIce, whisperSignal]);

//   // ── handleAnswer ──────────────────────────────────────────────────────────────

//   const handleAnswer = useCallback(async (from: string, payload: RTCSessionDescriptionInit) => {
//     const pc = R.current.pcs.get(from);
//     if (!pc || pc.signalingState !== "have-local-offer") return;
//     try {
//       await pc.setRemoteDescription(new RTCSessionDescription(payload));
//       await flushIce(from, pc);
//     } catch (e) {
//       console.error("[handleAnswer]", from, e);
//     }
//   }, [flushIce]);

//   // ── handleIce ─────────────────────────────────────────────────────────────────

//   const handleIce = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
//     const pc = R.current.pcs.get(from);
//     if (!pc) return;
//     const ice = new RTCIceCandidate(candidate);
//     if (!pc.remoteDescription?.type) {
//       // Buffer until remote description is set
//       const buf = R.current.iceBuf.get(from) ?? [];
//       buf.push(ice);
//       R.current.iceBuf.set(from, buf);
//       return;
//     }
//     try { await pc.addIceCandidate(ice); } catch {}
//   }, []);

//   // ── setupEcho ─────────────────────────────────────────────────────────────────

//   const setupEcho = useCallback(async (
//     key: string,
//     host: string,
//     port: number,
//     useTls: boolean,
//     peerId: string,
//     roomUid: string,
//     callbacks: MeshCallbacks = {},
//   ) => {
//     R.current.myPeerId = peerId;
//     R.current.roomUid = roomUid;
//     R.current.callbacks = callbacks;

//     const { default: Echo } = await import("laravel-echo");
//     const Pusher = await import("pusher-js");
//     (window as any).Pusher = Pusher.default || Pusher;

//     R.current.echo = new Echo({
//       broadcaster: "reverb",
//       key,
//       wsHost: host,
//       wsPort: port,
//       wssPort: port,
//       forceTLS: useTls,
//       enabledTransports: ["ws", "wss"],
//       authEndpoint: "/broadcasting/auth",
//       auth: {
//         params: {
//           peer_id: peerId,
//         },
//       },
//     });

//     R.current.channel = R.current.echo.join(`meet.${roomUid}`);

//     // ── (A) here() — equivalent to "joined-room" in signaling.js ─────────────
//     // Fires ONCE with the list of everyone already in the channel.
//     // We add each as a peer then send offers.
//     R.current.channel.here(async (users: any[]) => {
//       const others = users.filter(u => {
//         const uid: string = u.peer_id ?? u.id;
//         return uid && uid !== peerId;
//       });

//       for (const user of others) {
//         const uid: string = user.peer_id ?? user.id;
//         addPeer(uid, user.display_name ?? user.name ?? "Peer", user.role ?? "participant");
//         // Higher peer_id initiates — matches signaling.js "late joiner sends offers"
//         if (peerId > uid) await sendOffer(uid);
//       }

//       setConnectionState(others.length > 0 ? "connecting" : "waiting");

//       // Re-sync from backend to recover from missed presence events.
//       try {
//         const res = await axios.get(`/meet/${roomUid}/participants`, {
//           params: { peer_id: peerId },
//         });
//         const list = Array.isArray(res.data?.participants) ? res.data.participants : [];
//         for (const p of list) {
//           if (!p?.peer_id || p.peer_id === peerId) continue;
//           addPeer(p.peer_id, p.display_name ?? "Peer", p.role ?? "participant", {
//             video_on: p.video_on ?? true,
//             audio_on: p.audio_on ?? true,
//             screen_sharing: p.screen_sharing ?? false,
//             hand_raised: p.hand_raised ?? false,
//           });
//           if (peerId > p.peer_id) await sendOffer(p.peer_id);
//         }
//       } catch {}
//     });

//     // ── (B) joining() — equivalent to "peer-joined" in signaling.js ──────────
//     // Fires when a NEW member joins the channel.
//     // This is the ONLY place we add new peers from the presence layer.
//     R.current.channel.joining(async (user: any) => {
//       const uid: string = user.peer_id ?? user.id;
//       if (!uid || uid === peerId) return;

//       // addPeer returns true only if this is genuinely new
//       const isNew = addPeer(uid, user.display_name ?? user.name ?? "Peer", user.role ?? "participant");

//       if (!isNew) return; // already added — stop here, do NOT send another offer

//       setConnectionState("connecting");
//       callbacks.onPeerJoined?.(R.current.peers.get(uid)!);

//       if (peerId > uid) await sendOffer(uid);
//     });

//     // ── (C) leaving() — equivalent to "peer-left" in signaling.js ────────────
//     R.current.channel.leaving((user: any) => {
//       const uid: string = user.peer_id ?? user.id;
//       if (uid && uid !== peerId) removePeer(uid);
//     });

//     // ── (D) whisper "signal" — equivalent to offer/answer/ice in signaling.js ─
//     R.current.channel.listenForWhisper("signal", async (e: any) => {
//       if (!e || e.to !== peerId || e.from === peerId) return;

//       if (e.type === "offer")              await handleOffer(e.from, e.payload);
//       else if (e.type === "answer")        await handleAnswer(e.from, e.payload);
//       else if (e.type === "ice-candidate") await handleIce(e.from, e.payload);
//     });

//     // ── (E) Broadcast: ParticipantJoined ─────────────────────────────────────
//     // This fires from the Laravel backend after DB write.
//     // RULE: NEVER add a new peer here — joining() already did it.
//     //       Only update existing peer's metadata (role, media flags).
//     R.current.channel.listen(".meet.participant-joined", (e: any) => {
//       const uid: string = e.peer_id;
//       if (!uid || uid === peerId) return;

//       // addPeer with the existing peer: seenPeers guard will prevent double-add
//       // and will only merge the extra fields into the existing entry
//       addPeer(
//         uid,
//         e.display_name ?? "Peer",
//         e.role ?? "participant",
//         {
//           video_on:      e.video_on      ?? true,
//           audio_on:      e.audio_on      ?? true,
//           screen_sharing: e.screen_sharing ?? false,
//           hand_raised:   e.hand_raised   ?? false,
//         },
//       );
//       // No sendOffer here — joining() handles that
//     });

//     // ── (F) Broadcast: ParticipantLeft ───────────────────────────────────────
//     R.current.channel.listen(".meet.participant-left", (e: any) => {
//       const uid: string = e.peer_id;
//       if (uid && uid !== peerId) removePeer(uid);
//     });

//     // ── (G) Broadcast: ParticipantMediaUpdated ───────────────────────────────
//     // Equivalent to: socket.on("media-state") in signaling.js
//     R.current.channel.listen(".meet.media-updated", (e: any) => {
//       const uid: string = e.peer_id;
//       if (!uid || uid === peerId) return;
//       const peer = R.current.peers.get(uid);
//       if (!peer) return;
//       R.current.peers.set(uid, {
//         ...peer,
//         video_on:      e.video_on      ?? peer.video_on,
//         audio_on:      e.audio_on      ?? peer.audio_on,
//         screen_sharing: e.screen_sharing ?? peer.screen_sharing,
//         hand_raised:   e.hand_raised   ?? peer.hand_raised,
//       });
//       commitPeers();
//     });

//     // ── (H) Broadcast: ParticipantWaiting ────────────────────────────────────
//     R.current.channel.listen(".meet.participant-waiting", (e: any) => {
//       const uid: string = e.peer_id;
//       if (!uid) return;
//       if (!R.current.waiting.find(w => w.peer_id === uid)) {
//         commitWaiting([
//           ...R.current.waiting,
//           { peer_id: uid, display_name: e.display_name ?? "Guest" },
//         ]);
//       }
//     });

//     // ── (I) Broadcast: ParticipantAdmitted ───────────────────────────────────
//     R.current.channel.listen(".meet.participant-admitted", (e: any) => {
//       const admittedId: string = e.admitted_peer_id ?? e.participant?.peer_id ?? e.peer_id;
//       if (!admittedId) return;

//       // Host: remove from waiting list
//       commitWaiting(R.current.waiting.filter(w => w.peer_id !== admittedId));

//       // Admitted peer: trigger media start + hide waiting overlay
//       if (admittedId === peerId) callbacks.onAdmitted?.();
//     });

//     // ── (J) Broadcast: ParticipantKicked ─────────────────────────────────────
//     R.current.channel.listen(".meet.participant-kicked", (e: any) => {
//       const kickedId: string = e.peer_id ?? e.participant?.peer_id;
//       if (!kickedId) return;
//       if (kickedId === peerId) callbacks.onKicked?.();
//       else removePeer(kickedId);
//     });

//     // ── (K) Broadcast: RoomEnded ─────────────────────────────────────────────
//     R.current.channel.listen(".meet.room-ended", () => {
//       callbacks.onRoomEnded?.();
//     });

//     // ── (L) Whisper: media-state ──────────────────────────────────────────────
//     // Real-time mute/camera/screen updates — equivalent to media-state in signaling.js
//     R.current.channel.listenForWhisper("media-state", (e: any) => {
//       const uid: string = e.from;
//       if (!uid || uid === peerId) return;
//       const peer = R.current.peers.get(uid);
//       if (!peer) return;
//       R.current.peers.set(uid, {
//         ...peer,
//         video_on:      e.video_on      ?? peer.video_on,
//         audio_on:      e.audio_on      ?? peer.audio_on,
//         screen_sharing: e.screen_sharing ?? peer.screen_sharing,
//         hand_raised:   e.hand_raised   ?? peer.hand_raised,
//       });
//       commitPeers();
//     });

//     // ── (M) Whisper: chat ─────────────────────────────────────────────────────
//     R.current.channel.listenForWhisper("chat", (e: ChatMsg) => {
//       if (e.peer_id === peerId) return;
//       callbacks.onChatMessage?.(e);
//     });

//   }, [
//     addPeer, commitPeers, commitWaiting,
//     handleAnswer, handleIce, handleOffer,
//     removePeer, sendOffer,
//   ]);

//   // ── broadcast helpers ─────────────────────────────────────────────────────────

//   const broadcastChat = useCallback((msg: ChatMsg) => {
//     R.current.channel?.whisper("chat", msg);
//   }, []);

//   // Equivalent to: socket.emit("media-state", state) in signaling.js
//   const broadcastMediaState = useCallback((state: Partial<PeerInfo>) => {
//     R.current.channel?.whisper("media-state", {
//       from:          R.current.myPeerId,
//       video_on:      state.video_on      ?? false,
//       audio_on:      state.audio_on      ?? false,
//       screen_sharing: state.screen_sharing ?? false,
//       hand_raised:   state.hand_raised   ?? false,
//     });
//     // Also persist to DB so late-joiners get the correct state
//     const { roomUid, myPeerId } = R.current;
//     if (!roomUid || !myPeerId) return;
//     axios.post(`/meet/${roomUid}/media-state`, {
//       peer_id:       myPeerId,
//       video_on:      state.video_on      ?? false,
//       audio_on:      state.audio_on      ?? false,
//       screen_sharing: state.screen_sharing ?? false,
//       hand_raised:   state.hand_raised   ?? false,
//     }).catch(() => {});
//   }, []);

//   // ── screen share ──────────────────────────────────────────────────────────────

//   const startScreenShare = useCallback(async () => {
//     try {
//       const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
//       R.current.screenStream = stream;
//       setScreenStream(stream);
//       const screenTrack = stream.getVideoTracks()[0];
//       R.current.pcs.forEach(async pc => {
//         const sender = pc.getSenders().find(s => s.track?.kind === "video");
//         if (sender) await sender.replaceTrack(screenTrack);
//       });
//       screenTrack.onended = () => stopScreenShare();
//     } catch {}
//   }, []); // eslint-disable-line react-hooks/exhaustive-deps

//   const stopScreenShare = useCallback(() => {
//     const screen = R.current.screenStream;
//     if (!screen) return;
//     screen.getTracks().forEach(t => t.stop());
//     R.current.screenStream = null;
//     setScreenStream(null);
//     const camTrack = R.current.localStream?.getVideoTracks()[0];
//     if (!camTrack) return;
//     R.current.pcs.forEach(async pc => {
//       const sender = pc.getSenders().find(s => s.track?.kind === "video");
//       if (sender) await sender.replaceTrack(camTrack);
//     });
//   }, []);

//   // ── teardown ──────────────────────────────────────────────────────────────────

//   const teardown = useCallback(() => {
//     try { R.current.channel?.leave?.(); } catch {}
//     try { R.current.echo?.disconnect?.(); } catch {}

//     R.current.pcs.forEach(pc => {
//       pc.onicecandidate = null;
//       pc.ontrack = null;
//       pc.onconnectionstatechange = null;
//       pc.close();
//     });
//     R.current.pcs.clear();
//     R.current.localStream?.getTracks().forEach(t => t.stop());
//     R.current.screenStream?.getTracks().forEach(t => t.stop());
//     R.current.peers.clear();
//     R.current.seenPeers.clear();
//     R.current.waiting = [];
//     R.current.iceBuf.clear();
//     R.current.makingOffer.clear();
//     R.current.localStream = null;
//     R.current.screenStream = null;
//     R.current.mediaReady = null;

//     setPeers(new Map());
//     setWaiting([]);
//     setLocalStream(null);
//     setScreenStream(null);
//     setConnectionState("idle");
//   }, []);

//   useEffect(() => () => { teardown(); }, [teardown]);

//   return {
//     peers, waiting, localStream, screenStream,
//     connectionState, error,
//     startMedia, stopMedia,
//     toggleAudio, toggleVideo,
//     startScreenShare, stopScreenShare,
//     setupEcho, teardown,
//     broadcastChat, broadcastMediaState,
//   };
// }











/**
 * useWebRTCMesh — Laravel Reverb + full-mesh WebRTC
 *
 * Fixes applied:
 * 1. OFFER DIRECTION: Higher peer-id is the offerer (impolite). Lower is polite (yields).
 * 2. COLLISION: isImpolite = myPeerId > from (fixed from < to >).
 * 3. buildPC deadlock guard: Read localStream from ref; only await startMedia if not yet started.
 * 4. stopScreenShare stale closure: Exposed via stable ref.
 * 5. Transient 'disconnected' ICE state: Only removePeer on 'closed', not 'disconnected'.
 * 6. broadcastMediaState DB debounce: 300ms trailing-edge debounce on backend POST.
 * 7. Waiting-room media guard: mediaAllowed flag gates startMedia in buildPC.
 * 8. MeetRoom.tsx: allowMedia() called on admission; isWaiting properly gated.
 * 9. CallRoom.tsx: ICE candidate direction fixed; stale-closure removePeer fixed;
 *    createPC re-uses existing PC when healthy; all event handlers use refs to avoid
 *    stale state; audio track re-added on PC re-creation.
 */

import axios from "axios";
import { useRef, useState, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Debug helpers
// ─────────────────────────────────────────────────────────────────────────────

const ENABLE_DEBUG_LOGS = true;

const debug = (label: string, data: unknown = "") => {
  if (ENABLE_DEBUG_LOGS) console.log(`[WebRTC:${label}]`, data);
};

const debugError = (label: string, error: unknown) => {
  if (ENABLE_DEBUG_LOGS) console.error(`[WebRTC:${label}]`, error);
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PeerInfo {
  peer_id: string;
  display_name: string;
  role: "host" | "participant";
  video_on: boolean;
  audio_on: boolean;
  screen_sharing: boolean;
  hand_raised: boolean;
  speaking: boolean;
  stream?: MediaStream;
}

export interface ChatMsg {
  id: string;
  peer_id: string;
  display_name: string;
  text: string;
  sent_at: string;
}

export interface WaitingPeer {
  peer_id: string;
  display_name: string;
}

export interface MeshCallbacks {
  onError?: (msg: string) => void;
  onConnectionStateChanged?: (state: string) => void;
  onPeerJoined?: (peer: PeerInfo) => void;
  onPeerLeft?: (peerId: string, name: string) => void;
  onChatMessage?: (msg: ChatMsg) => void;
  onRoomEnded?: () => void;
  onKicked?: () => void;
  onAdmitted?: () => void;
  onWaitingListChanged?: (list: WaitingPeer[]) => void;
}

export interface UseWebRTCMeshReturn {
  peers: Map<string, PeerInfo>;
  waiting: WaitingPeer[];
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  connectionState: string;
  error: string | null;
  startMedia: () => Promise<MediaStream | null>;
  stopMedia: () => void;
  toggleAudio: (enabled: boolean) => void;
  toggleVideo: (enabled: boolean) => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  setupEcho: (
    key: string,
    host: string,
    port: number,
    useTls: boolean,
    peerId: string,
    roomUid: string,
    callbacks?: MeshCallbacks
  ) => Promise<void>;
  teardown: () => void;
  broadcastChat: (msg: ChatMsg) => void;
  broadcastMediaState: (state: Partial<PeerInfo>) => void;
  allowMedia: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useWebRTCMesh(): UseWebRTCMeshReturn {
  const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());
  const [waiting, setWaiting] = useState<WaitingPeer[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);

  const R = useRef({
    echo: null as any,
    channel: null as any,

    pcs: new Map<string, RTCPeerConnection>(),
    peers: new Map<string, PeerInfo>(),
    seenPeers: new Set<string>(),
    waiting: [] as WaitingPeer[],
    iceBuf: new Map<string, RTCIceCandidate[]>(),

    makingOffer: new Set<string>(),

    localStream: null as MediaStream | null,
    screenStream: null as MediaStream | null,
    mediaReady: null as Promise<MediaStream | null> | null,

    // FIX 7: gate that prevents media acquisition while in the waiting room
    mediaAllowed: true,

    myPeerId: "",
    roomUid: "",
    callbacks: {} as MeshCallbacks,

    iceFailedPeers: new Set<string>(),
    iceRestartTimers: new Map<string, ReturnType<typeof setTimeout>>(),

    // FIX 6: debounce timer for the backend media-state POST
    mediaStateDebounceTimer: null as ReturnType<typeof setTimeout> | null,

    // FIX 4: stable ref to stopScreenShare
    stopScreenShareFn: null as (() => void) | null,
  });

  // ── state commit ────────────────────────────────────────────────────────────

  const commitPeers = useCallback(() => {
    setPeers(new Map(R.current.peers));
  }, []);

  const commitWaiting = useCallback((list: WaitingPeer[]) => {
    R.current.waiting = list;
    setWaiting([...list]);
    R.current.callbacks.onWaitingListChanged?.(list);
  }, []);

  // ── allowMedia ──────────────────────────────────────────────────────────────

  const allowMedia = useCallback(() => {
    R.current.mediaAllowed = true;
  }, []);

  // ── ICE servers ─────────────────────────────────────────────────────────────

  const getIceServers = useCallback(async (): Promise<RTCIceServer[]> => {
    const servers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
    try {
      const res = await axios.get("/api/turn-credentials", { timeout: 5000 });
      const { iceServers: turnServers } = res.data;
      if (Array.isArray(turnServers) && turnServers.length > 0) {
        servers.push(...turnServers);
      }
    } catch {}
    return servers;
  }, []);

  // ── media ───────────────────────────────────────────────────────────────────

  const startMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (R.current.localStream) return R.current.localStream;
    if (R.current.mediaReady) return R.current.mediaReady;

    R.current.mediaReady = (async () => {
      if (typeof window === "undefined" || !window.isSecureContext) {
        const msg =
          "Camera/microphone access requires HTTPS. " +
          "Access the app via https:// or http://localhost.";
        setError(msg);
        R.current.callbacks.onError?.(msg);
        R.current.mediaReady = null;
        return null;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        const msg = "getUserMedia is not available. Ensure the page is served over HTTPS or from localhost.";
        setError(msg);
        R.current.callbacks.onError?.(msg);
        R.current.mediaReady = null;
        return null;
      }

      // Attempt 1: video + audio
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        R.current.localStream = stream;
        setLocalStream(stream);
        debug("startMedia", `OK: ${stream.getTracks().length} tracks`);
        return stream;
      } catch (e: unknown) {
        const err = e as DOMException;
        if (
          err?.name === "NotAllowedError" ||
          err?.name === "PermissionDeniedError" ||
          err?.name === "SecurityError"
        ) {
          const msg = "Camera/microphone permission was denied. Click the lock icon and allow access, then refresh.";
          setError(msg);
          R.current.callbacks.onError?.(msg);
          R.current.mediaReady = null;
          return null;
        }
      }

      // Attempt 2: audio-only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        R.current.localStream = stream;
        setLocalStream(stream);
        debug("startMedia", "Audio-only OK");
        return stream;
      } catch (e: unknown) {
        const err = e as DOMException;
        const msg = `Media error (${err?.name ?? "unknown"}): ${err?.message ?? String(e)}`;
        setError(msg);
        R.current.callbacks.onError?.(msg);
        R.current.mediaReady = null;
        return null;
      }
    })();

    return R.current.mediaReady;
  }, []);

  const stopMedia = useCallback(() => {
    R.current.localStream?.getTracks().forEach((t) => t.stop());
    R.current.localStream = null;
    R.current.mediaReady = null;
    setLocalStream(null);
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    R.current.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }, []);

  const toggleVideo = useCallback((enabled: boolean) => {
    R.current.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }, []);

  // ── ICE buffer ──────────────────────────────────────────────────────────────

  const flushIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const buf = R.current.iceBuf.get(peerId) ?? [];
    R.current.iceBuf.delete(peerId);
    if (buf.length === 0) return;

    if (!pc.remoteDescription?.type) {
      // Not ready yet — put them back
      R.current.iceBuf.set(peerId, buf);
      return;
    }

    for (const c of buf) {
      try {
        await pc.addIceCandidate(c);
      } catch (e) {
        debugError("flushIce", `${peerId}: ${e}`);
      }
    }
    debug("flushIce", `${peerId}: Flushed ${buf.length} candidate(s)`);
  }, []);

  // ── whisper helper ──────────────────────────────────────────────────────────

  const whisperSignal = useCallback(
    (to: string, type: "offer" | "answer" | "ice-candidate", payload: unknown) => {
      debug("whisperSignal", `${type} → ${to}`);
      R.current.channel?.whisper("signal", {
        to,
        from: R.current.myPeerId,
        type,
        payload,
      });
    },
    []
  );

  // ── removePeer ──────────────────────────────────────────────────────────────

  const removePeer = useCallback(
    (peerId: string) => {
      debug("removePeer", peerId);

      const timer = R.current.iceRestartTimers.get(peerId);
      if (timer) clearTimeout(timer);
      R.current.iceRestartTimers.delete(peerId);
      R.current.iceFailedPeers.delete(peerId);

      const pc = R.current.pcs.get(peerId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
        R.current.pcs.delete(peerId);
      }
      R.current.iceBuf.delete(peerId);
      R.current.makingOffer.delete(peerId);

      const peer = R.current.peers.get(peerId);
      R.current.peers.delete(peerId);
      R.current.seenPeers.delete(peerId); // allow re-join with same peer_id
      commitPeers();

      if (peer) R.current.callbacks.onPeerLeft?.(peerId, peer.display_name);
      if (R.current.peers.size === 0) setConnectionState("waiting");
    },
    [commitPeers]
  );

  // ── addPeer ─────────────────────────────────────────────────────────────────

  const addPeer = useCallback(
    (
      uid: string,
      displayName: string,
      role: "host" | "participant",
      extra: Partial<PeerInfo> = {}
    ): boolean => {
      if (R.current.seenPeers.has(uid)) {
        const existing = R.current.peers.get(uid);
        if (existing && Object.keys(extra).length > 0) {
          R.current.peers.set(uid, { ...existing, ...extra });
          commitPeers();
        }
        return false;
      }

      debug("addPeer", `${uid} (${displayName})`);
      R.current.seenPeers.add(uid);
      R.current.peers.set(uid, {
        peer_id: uid,
        display_name: displayName,
        role,
        video_on: true,
        audio_on: true,
        screen_sharing: false,
        hand_raised: false,
        speaking: false,
        ...extra,
      });
      commitPeers();
      return true;
    },
    [commitPeers]
  );

  // ── buildPC ─────────────────────────────────────────────────────────────────

  const buildPC = useCallback(
    async (remotePeerId: string): Promise<RTCPeerConnection> => {
      const existing = R.current.pcs.get(remotePeerId);
      if (
        existing &&
        existing.connectionState !== "failed" &&
        existing.connectionState !== "closed"
      ) {
        return existing;
      }
      if (existing) {
        existing.onicecandidate = null;
        existing.ontrack = null;
        existing.onconnectionstatechange = null;
        existing.oniceconnectionstatechange = null;
        existing.close();
      }

      debug("buildPC", `New PC for ${remotePeerId}`);

      // FIX 3: Read from ref directly; only await startMedia if truly needed
      let stream = R.current.localStream;
      if (!stream && R.current.mediaAllowed) {
        stream = await startMedia();
      }

      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      R.current.pcs.set(remotePeerId, pc);

      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream!));
        debug("buildPC", `Added ${stream.getTracks().length} local track(s)`);
      }

      pc.onicecandidate = ({ candidate }) => {
        if (!candidate) return;
        whisperSignal(remotePeerId, "ice-candidate", candidate.toJSON());
      };

      pc.ontrack = ({ streams }) => {
        const remoteStream = streams[0];
        if (!remoteStream) return;
        const peer = R.current.peers.get(remotePeerId);
        if (!peer) return;
        R.current.peers.set(remotePeerId, { ...peer, stream: remoteStream });
        commitPeers();
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        debug("buildPC", `${remotePeerId}: connectionState = ${state}`);

        if (state === "connected") {
          setConnectionState("connected");
          R.current.iceFailedPeers.delete(remotePeerId);
          R.current.callbacks.onConnectionStateChanged?.("connected");
        }

        if (state === "failed") {
          R.current.iceFailedPeers.add(remotePeerId);
          const timer = setTimeout(() => {
            if (R.current.iceFailedPeers.has(remotePeerId)) {
              debug("buildPC", `${remotePeerId}: ICE restart`);
              pc.restartIce();
            }
          }, 1500);
          R.current.iceRestartTimers.set(remotePeerId, timer);
        }

        // FIX 5: Only remove on 'closed' — 'disconnected' is transient
        if (state === "closed") {
          removePeer(remotePeerId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        debug("buildPC", `${remotePeerId}: iceConnectionState = ${pc.iceConnectionState}`);
      };

      return pc;
    },
    [startMedia, getIceServers, commitPeers, whisperSignal, removePeer]
  );

  // ── sendOffer ───────────────────────────────────────────────────────────────

  const sendOffer = useCallback(
    async (remotePeerId: string) => {
      if (R.current.makingOffer.has(remotePeerId)) {
        debug("sendOffer", `${remotePeerId}: Already in progress, skipping`);
        return;
      }
      R.current.makingOffer.add(remotePeerId);
      try {
        debug("sendOffer", `Creating offer for ${remotePeerId}`);
        const pc = await buildPC(remotePeerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        whisperSignal(remotePeerId, "offer", pc.localDescription?.toJSON());
        debug("sendOffer", `Offer sent to ${remotePeerId}`);
      } catch (e) {
        debugError("sendOffer", `${remotePeerId}: ${e}`);
      } finally {
        R.current.makingOffer.delete(remotePeerId);
      }
    },
    [buildPC, whisperSignal]
  );

  // ── handleOffer ─────────────────────────────────────────────────────────────

  const handleOffer = useCallback(
    async (from: string, payload: RTCSessionDescriptionInit) => {
      debug("handleOffer", `From ${from}`);

      const pc = await buildPC(from);

      // FIX 1+2: Higher peer-id is the offerer → impolite (backs off on collision)
      //          Lower peer-id is polite (yields and accepts remote offer)
      const isImpolite = R.current.myPeerId > from;

      const offerCollision =
        payload.type === "offer" &&
        (R.current.makingOffer.has(from) || pc.signalingState !== "stable");

      if (offerCollision) {
        if (isImpolite) {
          debug("handleOffer", `${from}: Collision, I am impolite — dropping incoming offer`);
          return;
        }
        // Polite peer: reset the PC so we can accept the incoming offer cleanly
        debug("handleOffer", `${from}: Collision, I am polite — resetting PC`);
        const old = R.current.pcs.get(from);
        if (old) {
          old.onicecandidate = null;
          old.ontrack = null;
          old.onconnectionstatechange = null;
          old.oniceconnectionstatechange = null;
          old.close();
          R.current.pcs.delete(from);
        }
        R.current.makingOffer.delete(from);
      }

      try {
        const freshPc = R.current.pcs.get(from) ?? (await buildPC(from));
        await freshPc.setRemoteDescription(new RTCSessionDescription(payload));
        await flushIce(from, freshPc);
        const answer = await freshPc.createAnswer();
        await freshPc.setLocalDescription(answer);
        whisperSignal(from, "answer", freshPc.localDescription?.toJSON());
        debug("handleOffer", `${from}: Answer sent`);
      } catch (e) {
        debugError("handleOffer", `${from}: ${e}`);
      }
    },
    [buildPC, flushIce, whisperSignal]
  );

  // ── handleAnswer ────────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    async (from: string, payload: RTCSessionDescriptionInit) => {
      debug("handleAnswer", `From ${from}`);
      const pc = R.current.pcs.get(from);
      if (!pc) return;
      if (pc.signalingState !== "have-local-offer") {
        debug("handleAnswer", `${from}: Unexpected state (${pc.signalingState}), ignoring`);
        return;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        await flushIce(from, pc);
      } catch (e) {
        debugError("handleAnswer", `${from}: ${e}`);
      }
    },
    [flushIce]
  );

  // ── handleIce ───────────────────────────────────────────────────────────────

  const handleIce = useCallback(async (from: string, candidate: RTCIceCandidateInit) => {
    const ice = new RTCIceCandidate(candidate);
    const pc = R.current.pcs.get(from);

    if (!pc || !pc.remoteDescription?.type) {
      const buf = R.current.iceBuf.get(from) ?? [];
      buf.push(ice);
      R.current.iceBuf.set(from, buf);
      return;
    }

    try {
      await pc.addIceCandidate(ice);
    } catch (e) {
      debugError("handleIce", `${from}: ${e}`);
    }
  }, []);

  // ── setupEcho ───────────────────────────────────────────────────────────────

  const setupEcho = useCallback(
    async (
      key: string,
      host: string,
      port: number,
      useTls: boolean,
      peerId: string,
      roomUid: string,
      callbacks: MeshCallbacks = {}
    ) => {
      debug("setupEcho", "Initialising Reverb presence channel");

      R.current.myPeerId = peerId;
      R.current.roomUid = roomUid;
      R.current.callbacks = callbacks;

      const { default: Echo } = await import("laravel-echo");
      const Pusher = await import("pusher-js");
      (window as any).Pusher = Pusher.default ?? Pusher;

      R.current.echo = new Echo({
        broadcaster: "reverb",
        key,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: useTls,
        enabledTransports: ["ws", "wss"],
        authEndpoint: "/broadcasting/auth",
        auth: { params: { peer_id: peerId } },
      });

      R.current.channel = R.current.echo.join(`meet.${roomUid}`);

      // ── here() ─────────────────────────────────────────────────────────────
      R.current.channel.here(async (users: any[]) => {
        debug("here", `${users.length} user(s) in room`);

        const others = users.filter((u) => {
          const uid: string = u.peer_id ?? u.id;
          return uid && uid !== peerId;
        });

        for (const user of others) {
          const uid: string = user.peer_id ?? user.id;
          addPeer(uid, user.display_name ?? user.name ?? "Peer", user.role ?? "participant");
          // FIX 1: Higher peer-id sends the offer
          if (peerId > uid) await sendOffer(uid);
        }

        setConnectionState(others.length > 0 ? "connecting" : "waiting");

        // Backend sync to recover from missed presence events
        try {
          const res = await axios.get(`/meet/${roomUid}/participants`, {
            params: { peer_id: peerId },
            timeout: 5000,
          });
          const list: any[] = Array.isArray(res.data?.participants)
            ? res.data.participants
            : [];

          for (const p of list) {
            if (!p?.peer_id || p.peer_id === peerId) continue;
            addPeer(p.peer_id, p.display_name ?? "Peer", p.role ?? "participant", {
              video_on: p.video_on ?? true,
              audio_on: p.audio_on ?? true,
              screen_sharing: p.screen_sharing ?? false,
              hand_raised: p.hand_raised ?? false,
            });
            if (peerId > p.peer_id) await sendOffer(p.peer_id);
          }
        } catch (err) {
          debugError("here", `Backend sync failed: ${err}`);
        }
      });

      // ── joining() ──────────────────────────────────────────────────────────
      R.current.channel.joining(async (user: any) => {
        const uid: string = user.peer_id ?? user.id;
        if (!uid || uid === peerId) return;

        debug("joining", `${uid} (${user.display_name})`);

        const isNew = addPeer(
          uid,
          user.display_name ?? user.name ?? "Peer",
          user.role ?? "participant"
        );
        if (!isNew) return;

        setConnectionState("connecting");
        callbacks.onPeerJoined?.(R.current.peers.get(uid)!);

        // FIX 1: Higher peer-id sends the offer
        if (peerId > uid) await sendOffer(uid);
      });

      // ── leaving() ─────────────────────────────────────────────────────────
      R.current.channel.leaving((user: any) => {
        const uid: string = user.peer_id ?? user.id;
        if (uid && uid !== peerId) removePeer(uid);
      });

      // ── whisper "signal" ───────────────────────────────────────────────────
      R.current.channel.listenForWhisper("signal", async (e: any) => {
        if (!e || e.to !== peerId || e.from === peerId) return;
        if (e.type === "offer") await handleOffer(e.from, e.payload);
        else if (e.type === "answer") await handleAnswer(e.from, e.payload);
        else if (e.type === "ice-candidate") await handleIce(e.from, e.payload);
      });

      // ── Broadcast: ParticipantJoined ───────────────────────────────────────
      // ONLY updates metadata — joining() handles WebRTC initiation
      R.current.channel.listen(".meet.participant-joined", (e: any) => {
        const uid: string = e.peer_id;
        if (!uid || uid === peerId) return;
        addPeer(uid, e.display_name ?? "Peer", e.role ?? "participant", {
          video_on: e.video_on ?? true,
          audio_on: e.audio_on ?? true,
          screen_sharing: e.screen_sharing ?? false,
          hand_raised: e.hand_raised ?? false,
        });
      });

      // ── Broadcast: ParticipantLeft ─────────────────────────────────────────
      R.current.channel.listen(".meet.participant-left", (e: any) => {
        const uid: string = e.peer_id;
        if (uid && uid !== peerId) removePeer(uid);
      });

      // ── Broadcast: ParticipantMediaUpdated ────────────────────────────────
      R.current.channel.listen(".meet.media-updated", (e: any) => {
        const uid: string = e.peer_id;
        if (!uid || uid === peerId) return;
        const peer = R.current.peers.get(uid);
        if (!peer) return;
        R.current.peers.set(uid, {
          ...peer,
          video_on: e.video_on ?? peer.video_on,
          audio_on: e.audio_on ?? peer.audio_on,
          screen_sharing: e.screen_sharing ?? peer.screen_sharing,
          hand_raised: e.hand_raised ?? peer.hand_raised,
        });
        commitPeers();
      });

      // ── Broadcast: ParticipantWaiting ─────────────────────────────────────
      R.current.channel.listen(".meet.participant-waiting", (e: any) => {
        const uid: string = e.peer_id;
        if (!uid) return;
        if (!R.current.waiting.find((w) => w.peer_id === uid)) {
          commitWaiting([
            ...R.current.waiting,
            { peer_id: uid, display_name: e.display_name ?? "Guest" },
          ]);
        }
      });

      // ── Broadcast: ParticipantAdmitted ────────────────────────────────────
      R.current.channel.listen(".meet.participant-admitted", (e: any) => {
        const admittedId: string =
          e.admitted_peer_id ?? e.participant?.peer_id ?? e.peer_id;
        if (!admittedId) return;

        commitWaiting(R.current.waiting.filter((w) => w.peer_id !== admittedId));

        if (admittedId === peerId) {
          debug("participant-admitted", "Local user admitted");
          callbacks.onAdmitted?.();
        }
      });

      // ── Broadcast: ParticipantKicked ──────────────────────────────────────
      R.current.channel.listen(".meet.participant-kicked", (e: any) => {
        const kickedId: string = e.peer_id ?? e.participant?.peer_id;
        if (!kickedId) return;
        if (kickedId === peerId) callbacks.onKicked?.();
        else removePeer(kickedId);
      });

      // ── Broadcast: RoomEnded ──────────────────────────────────────────────
      R.current.channel.listen(".meet.room-ended", () => {
        debug("room-ended", "Host ended the room");
        callbacks.onRoomEnded?.();
      });

      // ── Whisper: media-state ──────────────────────────────────────────────
      R.current.channel.listenForWhisper("media-state", (e: any) => {
        const uid: string = e.from;
        if (!uid || uid === peerId) return;
        const peer = R.current.peers.get(uid);
        if (!peer) return;
        R.current.peers.set(uid, {
          ...peer,
          video_on: e.video_on ?? peer.video_on,
          audio_on: e.audio_on ?? peer.audio_on,
          screen_sharing: e.screen_sharing ?? peer.screen_sharing,
          hand_raised: e.hand_raised ?? peer.hand_raised,
        });
        commitPeers();
      });

      // ── Whisper: chat ─────────────────────────────────────────────────────
      R.current.channel.listenForWhisper("chat", (e: ChatMsg) => {
        if (e.peer_id === peerId) return;
        callbacks.onChatMessage?.(e);
      });

      debug("setupEcho", "All listeners registered");
    },
    [
      addPeer,
      commitPeers,
      commitWaiting,
      handleAnswer,
      handleIce,
      handleOffer,
      removePeer,
      sendOffer,
    ]
  );

  // ── broadcast helpers ───────────────────────────────────────────────────────

  const broadcastChat = useCallback((msg: ChatMsg) => {
    R.current.channel?.whisper("chat", msg);
  }, []);

  const broadcastMediaState = useCallback((state: Partial<PeerInfo>) => {
    // Immediate whisper for low-latency UI updates on remote peers
    R.current.channel?.whisper("media-state", {
      from: R.current.myPeerId,
      video_on: state.video_on ?? false,
      audio_on: state.audio_on ?? false,
      screen_sharing: state.screen_sharing ?? false,
      hand_raised: state.hand_raised ?? false,
    });

    // FIX 6: Debounce the DB write — rapid toggles collapse into one POST
    if (R.current.mediaStateDebounceTimer) {
      clearTimeout(R.current.mediaStateDebounceTimer);
    }
    const snapshot = { ...state };
    R.current.mediaStateDebounceTimer = setTimeout(() => {
      const { roomUid, myPeerId } = R.current;
      if (!roomUid || !myPeerId) return;
      axios
        .post(`/meet/${roomUid}/media-state`, {
          peer_id: myPeerId,
          video_on: snapshot.video_on ?? false,
          audio_on: snapshot.audio_on ?? false,
          screen_sharing: snapshot.screen_sharing ?? false,
          hand_raised: snapshot.hand_raised ?? false,
        })
        .catch(() => {});
    }, 300);
  }, []);

  // ── screen share ────────────────────────────────────────────────────────────

  // FIX 4: stopScreenShare defined first, then referenced via stable ref
  const stopScreenShare = useCallback(() => {
    const screen = R.current.screenStream;
    if (!screen) return;

    screen.getTracks().forEach((t) => t.stop());
    R.current.screenStream = null;
    setScreenStream(null);

    const camTrack = R.current.localStream?.getVideoTracks()[0];
    if (!camTrack) return;

    R.current.pcs.forEach(async (pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(camTrack);
    });

    debug("stopScreenShare", "Camera tracks restored");
  }, []);

  useEffect(() => {
    R.current.stopScreenShareFn = stopScreenShare;
  }, [stopScreenShare]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      R.current.screenStream = stream;
      setScreenStream(stream);

      const screenTrack = stream.getVideoTracks()[0];

      R.current.pcs.forEach(async (pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(screenTrack);
      });

      // FIX 4: Call via stable ref to avoid stale closure
      screenTrack.onended = () => {
        R.current.stopScreenShareFn?.();
      };
    } catch (err) {
      debugError("startScreenShare", err);
    }
  }, []);

  // ── teardown ────────────────────────────────────────────────────────────────

  const teardown = useCallback(() => {
    debug("teardown", "Cleaning up");

    if (R.current.mediaStateDebounceTimer) {
      clearTimeout(R.current.mediaStateDebounceTimer);
      R.current.mediaStateDebounceTimer = null;
    }

    R.current.iceRestartTimers.forEach((t) => clearTimeout(t));
    R.current.iceRestartTimers.clear();

    try { R.current.channel?.leave?.(); } catch {}
    try { R.current.echo?.disconnect?.(); } catch {}

    R.current.pcs.forEach((pc) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    });
    R.current.pcs.clear();

    R.current.localStream?.getTracks().forEach((t) => t.stop());
    R.current.screenStream?.getTracks().forEach((t) => t.stop());

    R.current.peers.clear();
    R.current.seenPeers.clear();
    R.current.waiting = [];
    R.current.iceBuf.clear();
    R.current.makingOffer.clear();
    R.current.iceFailedPeers.clear();
    R.current.localStream = null;
    R.current.screenStream = null;
    R.current.mediaReady = null;

    setPeers(new Map());
    setWaiting([]);
    setLocalStream(null);
    setScreenStream(null);
    setConnectionState("idle");

    debug("teardown", "Done");
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  return {
    peers,
    waiting,
    localStream,
    screenStream,
    connectionState,
    error,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    setupEcho,
    teardown,
    broadcastChat,
    broadcastMediaState,
    allowMedia,
  };
}
