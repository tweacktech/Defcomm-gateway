export type * from './auth';
export type * from './navigation';
export type * from './ui';
export type ConnectionState =
  | "idle"
  | "waiting"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface PeerInfo {
  peerId: string;
  name: string;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  audioOn: boolean;
  videoOn: boolean;
  isScreenSharing: boolean;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}
