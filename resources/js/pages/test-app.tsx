import { useState, useCallback } from "react";
import { VideoTile } from "../components/VideoTile";
import { useWebRTC } from "../hooks/useWebRTC";
import type { PeerInfo } from "../types";
import "./App.css";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── lobby ────────────────────────────────────────────────────────────────────

function Lobby({ onJoin }: { onJoin: (id: string, name: string) => void }) {
  const [roomInput, setRoomInput] = useState("");
  const [nameInput, setNameInput] = useState("");

  const submit = (id: string) => onJoin(id, nameInput.trim() || "You");

  return (
    <div className="lobby">
      <div className="lobby-card">
        {/* logo */}
        <div className="lobby-logo">
          <span className="logo-gem">◈</span>
          <span className="logo-wordmark">
            WebRTC<span className="logo-accent">Local</span>
          </span>
        </div>
        <p className="lobby-tagline">P2P · TURN · Screen Share · Multi-peer</p>

        {/* inputs */}
        <div className="lobby-fields">
          <input
            className="lobby-input"
            placeholder="Your display name"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit(roomInput.trim() || makeRoomId())}
          />
          <input
            className="lobby-input lobby-input--room"
            placeholder="Room ID  (blank = new room)"
            value={roomInput}
            onChange={e => setRoomInput(e.target.value.toUpperCase())}
            maxLength={8}
            onKeyDown={e => e.key === "Enter" && submit(roomInput.trim() || makeRoomId())}
          />
        </div>

        {/* actions */}
        <div className="lobby-actions">
          <button className="btn btn--primary" onClick={() => submit(makeRoomId())}>
            + Create Room
          </button>
          <button
            className="btn btn--secondary"
            disabled={!roomInput.trim()}
            onClick={() => submit(roomInput.trim())}
          >
            Join →
          </button>
        </div>

        {/* info */}
        <div className="lobby-pills">
          <span className="pill">🔄 coturn :3478</span>
          <span className="pill">🔌 Signaling :3001</span>
          <span className="pill">🐳 Docker</span>
          <span className="pill">👥 Up to 4 peers</span>
          <span className="pill">🖥 Screen share</span>
        </div>
      </div>
    </div>
  );
}

// ─── grid layout decision ─────────────────────────────────────────────────────
// Returns CSS class that sets grid columns based on total tile count.

function gridClass(count: number): string {
  if (count === 1) return "grid--1";
  if (count === 2) return "grid--2";
  if (count <= 4)  return "grid--4";
  return "grid--6";
}

// ─── call room ────────────────────────────────────────────────────────────────

export default function TestApp() {
  const {
    localStream, screenStream, isScreenSharing,
    peers, connectionState, roomId, isInRoom,
    isMuted, isCameraOff, error, iceStates,
    joinRoom, leaveRoom,
    toggleMute, toggleCamera,
    startScreenShare, stopScreenShare,
  } = useWebRTC();

  const [myName, setMyName]     = useState("You");
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  const handleJoin = useCallback((id: string, name: string) => {
    setMyName(name);
    joinRoom(id, name);
  }, [joinRoom]);

  const copyRoom = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── if not in room, show lobby ─────────────────────────────────────────
  if (!isInRoom) return <Lobby onJoin={handleJoin} />;

  // ── build tile list ────────────────────────────────────────────────────
  const peerList = Array.from(peers.values());

  // local self peer object
  const localPeer: PeerInfo = {
    peerId: "__local",
    name: myName,
    stream: localStream,
    screenStream: screenStream,
    audioOn: !isMuted,
    videoOn: !isCameraOff,
    isScreenSharing,
  };

  // tiles: [local, ...remotes], plus a screen-share tile if anyone is sharing
  const sharingPeer  = peerList.find(p => p.isScreenSharing && p.screenStream);
  const screenPeer   = isScreenSharing ? localPeer : sharingPeer ?? null;
  const hasAnyScreen = !!screenPeer;

  // When pinned: show pinned peer large + everyone else in a strip
  // When screen sharing: screen is always the large tile
  const totalCamTiles = 1 + peerList.length; // local + remotes
  const showStrip     = hasAnyScreen;

  // status indicator
  const stateColors: Record<string, string> = {
    idle: "#64748b", waiting: "#f59e0b", connecting: "#3b82f6",
    connected: "#22c55e", disconnected: "#f97316", error: "#ef4444",
  };
  const stateLabels: Record<string, string> = {
    idle: "Idle", waiting: "Waiting for peer…", connecting: "Connecting…",
    connected: "Connected", disconnected: "Disconnected", error: "Error",
  };
  const dot   = stateColors[connectionState] ?? "#64748b";
  const label = stateLabels[connectionState] ?? connectionState;

  return (
    <div className="room">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="room-header">
        <div className="room-header-left">
          <span className="header-logo">◈ WebRTC<span className="logo-accent">Local</span></span>
          <div className="room-id-wrap">
            <span className="room-id-label">Room</span>
            <span className="room-id-value">{roomId}</span>
            <button className="room-id-copy" onClick={copyRoom}>
              {copied ? "✓ Copied" : "⎘ Copy"}
            </button>
          </div>
        </div>

        <div className="room-header-right">
          {/* participant count */}
          <span className="peer-count">
            👥 {1 + peerList.length} participant{peerList.length !== 0 ? "s" : ""}
          </span>

          {/* connection state */}
          <span className="conn-state" style={{ borderColor: dot, color: dot }}>
            <span className="conn-dot" style={{ background: dot }} />
            {label}
          </span>

          {/* ICE state for debug */}
          {iceStates.size > 0 && (
            <span className="ice-states">
              {Array.from(iceStates.entries()).map(([pid, s]) => (
                <span key={pid} className="ice-badge">{s}</span>
              ))}
            </span>
          )}
        </div>
      </header>

      {error && <div className="error-bar">⚠ {error}</div>}

      {/* ── Main stage ────────────────────────────────────────────────────── */}
      <main className="room-stage">

        {/* Screen share / pinned view (large) */}
        {hasAnyScreen && screenPeer && (
          <div className="screen-area">
            <VideoTile
              peer={screenPeer}
              local={screenPeer.peerId === "__local"}
              isScreen
            />
            {isScreenSharing && (
              <button className="stop-share-btn" onClick={stopScreenShare}>
                ⬜ Stop sharing
              </button>
            )}
          </div>
        )}

        {/* Camera grid */}
        <div className={`cam-grid ${showStrip ? "cam-grid--strip" : gridClass(totalCamTiles)}`}>

          {/* local tile */}
          <VideoTile
            peer={localPeer}
            local
            pinned={!hasAnyScreen && pinnedId === "__local"}
            onClick={() => !hasAnyScreen && setPinnedId(id => id === "__local" ? null : "__local")}
          />

          {/* remote tiles */}
          {peerList.map(peer => (
            <VideoTile
              key={peer.peerId}
              peer={peer}
              pinned={!hasAnyScreen && pinnedId === peer.peerId}
              onClick={() => !hasAnyScreen && setPinnedId(id => id === peer.peerId ? null : peer.peerId)}
            />
          ))}

          {/* empty waiting slot */}
          {peerList.length === 0 && !hasAnyScreen && (
            <div className="waiting-slot">
              <span className="waiting-slot-icon">📡</span>
              <p>Waiting for participants</p>
              <code className="waiting-room-id">{roomId}</code>
            </div>
          )}
        </div>
      </main>

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <footer className="controls">
        {/* Mute */}
        <button
          className={`ctrl-btn ${isMuted ? "ctrl-btn--off" : "ctrl-btn--on"}`}
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
          <span>{isMuted ? "Unmute" : "Mute"}</span>
        </button>

        {/* Camera */}
        <button
          className={`ctrl-btn ${isCameraOff ? "ctrl-btn--off" : "ctrl-btn--on"}`}
          onClick={toggleCamera}
          title={isCameraOff ? "Camera on" : "Camera off"}
        >
          {isCameraOff ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          )}
          <span>{isCameraOff ? "Camera On" : "Camera Off"}</span>
        </button>

        {/* Screen share */}
        <button
          className={`ctrl-btn ${isScreenSharing ? "ctrl-btn--blue" : "ctrl-btn--on"}`}
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          {isScreenSharing ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          )}
          <span>{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
        </button>

        {/* Leave */}
        <button className="ctrl-btn ctrl-btn--end" onClick={leaveRoom} title="Leave">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 5 13M1 1l22 22"/>
            <path d="M5.04 5.04A19.58 19.58 0 0 0 1.14 9.7 2 2 0 0 0 3.56 12h3a2 2 0 0 1 2 1.72c.126.96.36 1.9.7 2.81"/>
          </svg>
          <span>Leave</span>
        </button>
      </footer>
    </div>
  );
}
