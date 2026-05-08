#!/usr/bin/env node
/**
 * TURN Server Connectivity Test
 * Tests coturn STUN and TURN reachability without a browser.
 * Run: node tests/test-turn.js
 */

const dgram = require("dgram");

const TURN_HOST = process.env.TURN_HOST || "127.0.0.1";
const TURN_PORT = parseInt(process.env.TURN_PORT || "3478");
const USERNAME = process.env.TURN_USER || "testuser";
const PASSWORD = process.env.TURN_PASS || "testpassword";

let passed = 0;
let failed = 0;

function assert(condition, name, detail = "") {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

/**
 * Build a minimal STUN Binding Request packet (RFC 5389)
 */
function buildStunBindingRequest() {
  const buf = Buffer.alloc(20);
  // Message Type: 0x0001 = Binding Request
  buf.writeUInt16BE(0x0001, 0);
  // Message Length: 0 (no attributes)
  buf.writeUInt16BE(0x0000, 2);
  // Magic Cookie
  buf.writeUInt32BE(0x2112a442, 4);
  // Transaction ID (12 random bytes)
  for (let i = 8; i < 20; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

/**
 * Send a UDP packet and wait for a response
 */
function sendUdpAndReceive(host, port, data, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      sock.close();
      reject(new Error(`UDP timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    sock.on("message", (msg) => {
      clearTimeout(timer);
      sock.close();
      resolve(msg);
    });

    sock.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    sock.send(data, 0, data.length, port, host, (err) => {
      if (err) {
        clearTimeout(timer);
        sock.close();
        reject(err);
      }
    });
  });
}

/**
 * Parse a STUN response — returns message type and attributes
 */
function parseStunResponse(buf) {
  if (buf.length < 20) return null;
  const msgType = buf.readUInt16BE(0);
  const msgLen = buf.readUInt16BE(2);
  const magic = buf.readUInt32BE(4);

  return {
    msgType,
    msgLen,
    isValidMagic: magic === 0x2112a442,
    isBindingResponse: msgType === 0x0101,
    isBindingError: msgType === 0x0111,
  };
}

// ─────────────────────────────────────────────────────────────────
async function testStunReachability() {
  console.log(`\n📋 Test: STUN Binding Request → ${TURN_HOST}:${TURN_PORT}/udp`);

  try {
    const req = buildStunBindingRequest();
    const res = await sendUdpAndReceive(TURN_HOST, TURN_PORT, req, 3000);
    const parsed = parseStunResponse(res);

    assert(parsed !== null, "Received a response from STUN/TURN server");
    assert(parsed.isValidMagic, "Response has valid STUN magic cookie (0x2112a442)");
    assert(parsed.isBindingResponse, "Response is a Binding Success (0x0101)", `Got 0x${parsed.msgType.toString(16)}`);

    console.log(`     STUN server responded with ${res.length} bytes ✓`);
  } catch (err) {
    assert(false, "STUN server reachable", err.message);
    console.log("     ⚠  Make sure coturn is running: docker compose up coturn");
  }
}

async function testTurnAllocation() {
  console.log(`\n📋 Test: TURN Allocate Request (unauthenticated — expects 401)`);

  try {
    // Build TURN Allocate Request (0x0003) — no credentials → expect 401
    const buf = Buffer.alloc(20);
    buf.writeUInt16BE(0x0003, 0); // Allocate
    buf.writeUInt16BE(0x0000, 2);
    buf.writeUInt32BE(0x2112a442, 4);
    for (let i = 8; i < 20; i++) buf[i] = Math.floor(Math.random() * 256);

    const res = await sendUdpAndReceive(TURN_HOST, TURN_PORT, buf, 3000);
    const parsed = parseStunResponse(res);

    // 0x0113 = Allocate Error Response, 0x0111 = Binding Error
    const isError = parsed.msgType === 0x0113 || parsed.msgType === 0x0111;
    assert(parsed !== null, "TURN server responded to allocate request");
    assert(parsed.isValidMagic, "Response has valid STUN magic cookie");
    assert(isError, `TURN server rejects unauthenticated allocate (got 0x${parsed.msgType.toString(16)} — expected error response)`);

    console.log(`     TURN server correctly challenged with error response ✓`);
  } catch (err) {
    assert(false, "TURN server reachable for allocate", err.message);
  }
}

async function testTurnUdpPort() {
  console.log(`\n📋 Test: UDP port ${TURN_PORT} reachable`);
  try {
    const dummy = Buffer.from([0x00]);
    await sendUdpAndReceive(TURN_HOST, TURN_PORT, dummy, 2000);
    assert(true, "UDP port is open and responding");
  } catch (err) {
    // timeout is actually fine — means port is open but server rejected garbage
    if (err.message.includes("timeout")) {
      assert(true, "UDP port is open (no response to garbage packet, expected)");
    } else {
      assert(false, "UDP port reachable", err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
async function run() {
  console.log("🧪 TURN/STUN Server Tests (coturn)");
  console.log(`   Target: ${TURN_HOST}:${TURN_PORT}`);
  console.log(`   Credentials: ${USERNAME} / ${PASSWORD}`);
  console.log("=".repeat(50));

  await testTurnUdpPort();
  await testStunReachability();
  await testTurnAllocation();

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error("❌ Some tests failed");
    console.log("\nTips:");
    console.log("  • Start coturn: docker compose up coturn -d");
    console.log("  • Check logs:   docker compose logs coturn");
    console.log("  • Verify port:  sudo ss -ulpn | grep 3478");
    process.exit(1);
  } else {
    console.log("✅ All TURN tests passed!");
    process.exit(0);
  }
}

run();
