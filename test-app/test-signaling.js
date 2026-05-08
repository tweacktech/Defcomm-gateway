/**
 * Signaling Server Tests
 * Run: node tests/test-signaling.js
 * Requires signaling server running on localhost:3001
 */

const { io } = require("socket.io-client");

const SIGNALING_URL = "http://localhost:3001";
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    failed++;
  }
}

function timeout(ms) {
  return new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout after ${ms}ms`)), ms));
}

async function testHealthEndpoint() {
  console.log("\n📋 Test: Health endpoint");
  const res = await fetch(`${SIGNALING_URL}/health`);
  const data = await res.json();
  assert(res.ok, "HTTP 200 response");
  assert(data.status === "ok", "Status is 'ok'");
  assert(typeof data.timestamp === "number", "Has timestamp");
}

async function testTurnCredentials() {
  console.log("\n📋 Test: TURN credentials endpoint");
  const res = await fetch(`${SIGNALING_URL}/turn-credentials`);
  const data = await res.json();
  assert(res.ok, "HTTP 200 response");
  assert(Array.isArray(data.iceServers), "iceServers is an array");
  assert(data.iceServers.length >= 2, "Has STUN and TURN entries");
  const hasTurn = data.iceServers.some((s) => s.urls?.startsWith("turn:"));
  assert(hasTurn, "Has TURN server entry");
  const turnServer = data.iceServers.find((s) => s.urls?.startsWith("turn:"));
  assert(turnServer?.username === "testuser", "TURN username is 'testuser'");
  assert(turnServer?.credential === "testpassword", "TURN credential is 'testpassword'");
}

async function testRoomJoin() {
  console.log("\n📋 Test: Room join (single peer)");
  return new Promise((resolve, reject) => {
    const socket = io(SIGNALING_URL, { transports: ["websocket"] });

    socket.on("connect", () => {
      assert(true, "Socket connected");
      socket.emit("join-room", { roomId: "TEST01" });
    });

    socket.on("joined-room", ({ roomId, isInitiator, peers }) => {
      assert(roomId === "TEST01", "Joined correct room");
      assert(isInitiator === false, "First peer is not initiator (no other peer)");
      assert(peers.length === 0, "No other peers yet");
      socket.disconnect();
      resolve();
    });

    socket.on("connect_error", (e) => reject(e));
    setTimeout(() => reject(new Error("Room join timeout")), 5000);
  });
}

async function testTwoPeerSignaling() {
  console.log("\n📋 Test: Two-peer signaling flow (offer/answer/ICE)");
  const ROOM = "TEST02";

  return new Promise((resolve, reject) => {
    const peer1 = io(SIGNALING_URL, { transports: ["websocket"] });
    const peer2 = io(SIGNALING_URL, { transports: ["websocket"] });
    const events = [];

    peer1.on("connect", () => peer1.emit("join-room", { roomId: ROOM }));

    peer1.on("joined-room", ({ isInitiator }) => {
      events.push("peer1-joined");
      assert(!isInitiator, "Peer1 not initiator (no peer yet)");
      // Now peer2 joins
      peer2.emit("join-room", { roomId: ROOM });
    });

    peer1.on("peer-joined", ({ peerId }) => {
      events.push("peer1-peer-joined");
      assert(peerId === peer2.id, "Peer1 notified of peer2");
    });

    peer2.on("joined-room", ({ isInitiator, peers }) => {
      events.push("peer2-joined");
      assert(isInitiator, "Peer2 is initiator");
      assert(peers.includes(peer1.id), "Peer2 sees peer1");

      // Simulate offer
      peer2.emit("offer", { to: peer1.id, offer: { type: "offer", sdp: "mock-sdp" } });
    });

    peer1.on("offer", ({ from, offer }) => {
      events.push("peer1-received-offer");
      assert(from === peer2.id, "Offer from peer2");
      assert(offer.sdp === "mock-sdp", "Offer SDP passed through");

      // Answer
      peer1.emit("answer", { to: peer2.id, answer: { type: "answer", sdp: "mock-answer" } });
    });

    peer2.on("answer", ({ from, answer }) => {
      events.push("peer2-received-answer");
      assert(from === peer1.id, "Answer from peer1");
      assert(answer.sdp === "mock-answer", "Answer SDP passed through");

      // ICE candidates
      peer1.emit("ice-candidate", { to: peer2.id, candidate: { candidate: "mock-ice-1" } });
      peer2.emit("ice-candidate", { to: peer1.id, candidate: { candidate: "mock-ice-2" } });
    });

    let iceCount = 0;
    const checkDone = () => {
      iceCount++;
      if (iceCount === 2) {
        assert(events.includes("peer1-joined"), "Peer1 join event");
        assert(events.includes("peer2-joined"), "Peer2 join event");
        assert(events.includes("peer1-received-offer"), "Offer relayed");
        assert(events.includes("peer2-received-answer"), "Answer relayed");
        peer1.disconnect();
        peer2.disconnect();
        resolve();
      }
    };

    peer1.on("ice-candidate", ({ candidate }) => {
      assert(candidate.candidate === "mock-ice-2", "ICE candidate from peer2 to peer1");
      checkDone();
    });

    peer2.on("ice-candidate", ({ candidate }) => {
      assert(candidate.candidate === "mock-ice-1", "ICE candidate from peer1 to peer2");
      checkDone();
    });

    setTimeout(() => reject(new Error("Two-peer test timeout")), 8000);
  });
}

async function testRoomFull() {
  console.log("\n📋 Test: Room full (3rd peer rejected)");
  const ROOM = "TEST03";

  return new Promise((resolve, reject) => {
    const p1 = io(SIGNALING_URL, { transports: ["websocket"] });
    const p2 = io(SIGNALING_URL, { transports: ["websocket"] });
    const p3 = io(SIGNALING_URL, { transports: ["websocket"] });

    let joined = 0;
    const onJoined = () => {
      joined++;
      if (joined === 2) p3.emit("join-room", { roomId: ROOM });
    };

    p1.on("connect", () => p1.emit("join-room", { roomId: ROOM }));
    p2.on("connect", () => setTimeout(() => p2.emit("join-room", { roomId: ROOM }), 100));
    p1.on("joined-room", onJoined);
    p2.on("joined-room", onJoined);

    p3.on("room-full", ({ roomId }) => {
      assert(roomId === ROOM, "Room-full event has correct roomId");
      p1.disconnect();
      p2.disconnect();
      p3.disconnect();
      resolve();
    });

    setTimeout(() => reject(new Error("Room full test timeout")), 8000);
  });
}

async function testPeerLeft() {
  console.log("\n📋 Test: Peer-left notification");
  const ROOM = "TEST04";

  return new Promise((resolve, reject) => {
    const p1 = io(SIGNALING_URL, { transports: ["websocket"] });
    const p2 = io(SIGNALING_URL, { transports: ["websocket"] });

    p1.on("connect", () => p1.emit("join-room", { roomId: ROOM }));
    p2.on("connect", () => setTimeout(() => p2.emit("join-room", { roomId: ROOM }), 100));

    let p2Id = null;
    p2.on("connect", () => (p2Id = p2.id));

    p2.on("joined-room", () => {
      setTimeout(() => p2.disconnect(), 200);
    });

    p1.on("peer-left", ({ peerId }) => {
      assert(true, "peer-left event received by peer1");
      p1.disconnect();
      resolve();
    });

    setTimeout(() => reject(new Error("Peer-left test timeout")), 8000);
  });
}

// ── Runner ────────────────────────────────────────────────────────
async function run() {
  console.log("🧪 WebRTC Signaling Server Tests");
  console.log(`   Target: ${SIGNALING_URL}`);
  console.log("=".repeat(50));

  try {
    await testHealthEndpoint();
    await testTurnCredentials();
    await testRoomJoin();
    await testTwoPeerSignaling();
    await testRoomFull();
    await testPeerLeft();
  } catch (err) {
    console.error("\n💥 Test error:", err.message);
    failed++;
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error("❌ Some tests failed");
    process.exit(1);
  } else {
    console.log("✅ All tests passed!");
    process.exit(0);
  }
}

run();
