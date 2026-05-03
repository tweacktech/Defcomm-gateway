/**
 * Signaling server v2 — mesh multi-peer
 *
 * Changes from v1:
 *  - Room cap raised from 2 → MAX_PEERS (default 4)
 *  - join-room carries `name`; rooms store { socketId → name }
 *  - joined-room sends back array of { peerId, name } (not just IDs)
 *  - peer-joined carries `name`
 *  - offer relay carries `name` (so late joiners get the label immediately)
 *  - media-state relay (mute/camera/screen) broadcast to room
 *  - ICE candidate relay carries `from` (unchanged)
 */

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const MAX_PEERS = 4;

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: Date.now() }));

app.get("/turn-credentials", (_req, res) => {
  const host = process.env.TURN_HOST || "localhost";
  const user = process.env.TURN_USER || "testuser";
  const pass = process.env.TURN_PASS || "testpassword";
  res.json({
    iceServers: [
      { urls: `stun:${host}:3478` },
      { urls: `turn:${host}:3478`, username: user, credential: pass },
      { urls: `turn:${host}:3478?transport=tcp`, username: user, credential: pass },
    ],
  });
});

// rooms: roomId → Map<socketId, { name }>
const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on("join-room", ({ roomId, name }) => {
    if (!rooms.has(roomId)) rooms.set(roomId, new Map());
    const room = rooms.get(roomId);

    if (room.size >= MAX_PEERS) {
      socket.emit("room-full", { roomId, max: MAX_PEERS });
      return;
    }

    const peerName = name || "Peer";
    room.set(socket.id, { name: peerName });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name   = peerName;

    // Tell the joiner about everyone already present
    const existingPeers = [...room.entries()]
      .filter(([id]) => id !== socket.id)
      .map(([id, info]) => ({ peerId: id, name: info.name }));

    socket.emit("joined-room", { roomId, peers: existingPeers });

    // Tell everyone else about the newcomer
    socket.to(roomId).emit("peer-joined", { peerId: socket.id, name: peerName });

    console.log(`[room] ${socket.id} (${peerName}) → ${roomId} (${room.size}/${MAX_PEERS})`);
  });

  // ── WebRTC signaling ───────────────────────────────────────────────────────
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", { from: socket.id, offer, name: socket.data.name });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  // ── media state relay ──────────────────────────────────────────────────────
  socket.on("media-state", (state) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("media-state", {
      from: socket.id,
      audioOn:         state.audioOn,
      videoOn:         state.videoOn,
      isScreenSharing: state.isScreenSharing,
    });
  });

  // ── leave ──────────────────────────────────────────────────────────────────
  function handleLeave() {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) rooms.delete(roomId);
    }
    socket.to(roomId).emit("peer-left", { peerId: socket.id });
    socket.data.roomId = null;
    console.log(`[-] ${socket.id} left ${roomId}`);
  }

  socket.on("leave-room",  handleLeave);
  socket.on("disconnect",  () => { console.log(`[-] ${socket.id}`); handleLeave(); });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Signaling server :${PORT} (max ${MAX_PEERS} peers/room)`));
