import { useEffect, useRef } from "react";
import type { PeerInfo } from "../types";

interface Props {
  peer: PeerInfo;
  local?: boolean;
  pinned?: boolean;
  isScreen?: boolean; // render the screenStream instead of stream
  onClick?: () => void;
}

export function VideoTile({ peer, local = false, pinned = false, isScreen = false, onClick }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const stream = isScreen ? peer.screenStream : peer.stream;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream ?? null;
  }, [stream]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || local) return;
    el.muted = false;
    if (stream) el.play().catch(() => {});
  }, [stream, local]);

  const initial = (peer.name?.[0] ?? "?").toUpperCase();
  const showVideo = !isScreen ? peer.videoOn && !!stream : !!stream;

  return (
    <div
      onClick={onClick}
      className={[
        "video-tile",
        pinned        ? "video-tile--pinned"  : "",
        isScreen      ? "video-tile--screen"  : "",
        onClick       ? "video-tile--clickable" : "",
      ].filter(Boolean).join(" ")}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={local}
        className={showVideo ? "tile-video" : "tile-video tile-video--hidden"}
      />

      {!showVideo && (
        <div className="tile-avatar">
          <div className="tile-avatar-circle">{initial}</div>
        </div>
      )}

      {/* overlay labels */}
      <div className="tile-bar">
        {!peer.audioOn && !local && (
          <svg className="tile-icon tile-icon--muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        )}
        {isScreen && (
          <svg className="tile-icon tile-icon--screen" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        )}
        <span className="tile-name">
          {local ? `${peer.name} (You)` : peer.name}
          {isScreen ? " — Screen" : ""}
        </span>
      </div>
    </div>
  );
}
