/**
 * DefcommMeet SDK
 * ─────────────────────────────────────────────────────────────────────────────
 * Embed voice/video calls into any web app.
 *
 * Install (once published as npm package):
 *   npm install @defcomm/meet-sdk
 *
 * Usage (third-party app):
 *   import { DefcommMeet } from '@defcomm/meet-sdk';
 *
 *   const meet = new DefcommMeet({
 *     serverUrl: 'https://your-defcomm-instance.com',
 *     apiToken: 'your-sanctum-token',     // server-side only
 *   });
 *
 *   // Create a room from your backend
 *   const { room, token } = await meet.createRoom({ name: 'Support Call' });
 *
 *   // Embed the call in your frontend
 *   meet.embed('#call-container', { roomUid: room.uid, token });
 *
 *   // Or use the standalone React component
 *   import { MeetRoom } from '@defcomm/meet-sdk/react';
 *   <MeetRoom serverUrl="..." roomUid="..." joinToken="..." />
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DefcommMeetConfig {
  serverUrl: string;
  apiToken?: string;       // Sanctum API token (server-side use only)
  onError?: (err: Error) => void;
}

export interface CreateRoomOptions {
  name?: string;
  password?: string;
  maxParticipants?: number;
  videoEnabled?: boolean;
  audioEnabled?: boolean;
  waitingRoom?: boolean;
  allowedHosts?: string[];
  webhookUrl?: string;
  webhookEvents?: string[];
}

export interface RoomInfo {
  uid: string;
  name: string;
  status: 'scheduled' | 'active' | 'ended';
  joinUrl: string;
  embedUrl: string;
  hasPassword: boolean;
  maxParticipants: number;
  activeParticipants: number;
}

export interface JoinTokenOptions {
  displayName: string;
  userId?: number | string;
  role?: 'host' | 'co-host' | 'participant' | 'viewer';
}

export type MeetEventType =
  | 'room.started'
  | 'room.ended'
  | 'participant.joined'
  | 'participant.left'
  | 'recording.started'
  | 'recording.ready';

// ─── SDK Class ────────────────────────────────────────────────────────────────

export class DefcommMeet {
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(private readonly config: DefcommMeetConfig) {
    this.baseUrl  = config.serverUrl.replace(/\/$/, '') + '/api/meet';
    this.apiToken = config.apiToken ?? '';
  }

  // ── Room Management ─────────────────────────────────────────────────────────

  /**
   * Create a new room. Call this from your server — never expose apiToken client-side.
   */
  async createRoom(options: CreateRoomOptions = {}): Promise<{
    room: RoomInfo;
    joinToken: string;
    embedUrl: string;
  }> {
    const res = await this.request('POST', '/rooms', {
      name:              options.name,
      password:          options.password,
      max_participants:  options.maxParticipants,
      video_enabled:     options.videoEnabled ?? true,
      audio_enabled:     options.audioEnabled ?? true,
      waiting_room:      options.waitingRoom ?? false,
      allowed_hosts:     options.allowedHosts,
      webhook_url:       options.webhookUrl,
      webhook_events:    options.webhookEvents,
    });

    return {
      room:       this.normalizeRoom(res.data.room),
      joinToken:  res.data.join_token,
      embedUrl:   res.data.embed_url,
    };
  }

  /**
   * Get room info.
   */
  async getRoom(uid: string): Promise<RoomInfo> {
    const res = await this.request('GET', `/rooms/${uid}`);
    return this.normalizeRoom(res.data);
  }

  /**
   * List all rooms for this API key.
   */
  async listRooms(status?: 'scheduled' | 'active' | 'ended'): Promise<RoomInfo[]> {
    const qs   = status ? `?status=${status}` : '';
    const res  = await this.request('GET', `/rooms${qs}`);
    return res.data.map((r: any) => this.normalizeRoom(r));
  }

  /**
   * End a room.
   */
  async endRoom(uid: string): Promise<void> {
    await this.request('DELETE', `/rooms/${uid}`);
  }

  /**
   * Issue a join token for a specific participant.
   * Call from your backend — pass the token to your frontend securely.
   */
  async issueJoinToken(uid: string, opts: JoinTokenOptions): Promise<{
    token: string;
    joinUrl: string;
    embedUrl: string;
  }> {
    const res = await this.request('POST', `/rooms/${uid}/token`, {
      display_name: opts.displayName,
      user_id:      opts.userId,
      role:         opts.role ?? 'participant',
    });

    return {
      token:    res.data.token,
      joinUrl:  res.data.join_url,
      embedUrl: res.data.embed_url,
    };
  }

  // ── Embed (client-side) ─────────────────────────────────────────────────────

  /**
   * Embed the call UI into a DOM element as an iframe.
   * This is safe to call client-side — only needs the room uid and a join token.
   */
  embed(selector: string | HTMLElement, options: {
    roomUid: string;
    token?: string;
    displayName?: string;
    width?: string;
    height?: string;
    onReady?: () => void;
    onEnded?: () => void;
  }): () => void {
    const container = typeof selector === 'string'
      ? document.querySelector<HTMLElement>(selector)
      : selector;

    if (!container) throw new Error(`DefcommMeet: container "${selector}" not found`);

    const params = new URLSearchParams();
    if (options.token)       params.set('token', options.token);
    if (options.displayName) params.set('name', options.displayName);
    params.set('embed', '1');

    const src = `${this.config.serverUrl}/embed/meet/${options.roomUid}?${params}`;

    const iframe = document.createElement('iframe');
    iframe.src              = src;
    iframe.width            = options.width  ?? '100%';
    iframe.height           = options.height ?? '600px';
    iframe.style.border     = 'none';
    iframe.style.borderRadius = '12px';
    iframe.allow            = 'camera; microphone; display-capture; fullscreen';
    iframe.allowFullscreen  = true;

    // Listen for postMessage events from the iframe
    const handler = (e: MessageEvent) => {
      if (e.origin !== this.config.serverUrl) return;
      if (e.data?.type === 'meet:ready') options.onReady?.();
      if (e.data?.type === 'meet:ended') options.onEnded?.();
    };

    window.addEventListener('message', handler);
    container.appendChild(iframe);

    // Return cleanup function
    return () => {
      window.removeEventListener('message', handler);
      container.removeChild(iframe);
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async request(method: string, path: string, body?: object): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'Authorization': `Bearer ${this.apiToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(json.message ?? `HTTP ${res.status}`);
      this.config.onError?.(err);
      throw err;
    }

    return json;
  }

  private normalizeRoom(r: any): RoomInfo {
    return {
      uid:                r.uid,
      name:               r.name,
      status:             r.status,
      joinUrl:            r.join_url,
      embedUrl:           r.embed_url,
      hasPassword:        r.has_password,
      maxParticipants:    r.max_participants,
      activeParticipants: r.active_participants,
    };
  }
}

// ─── Convenience factory ──────────────────────────────────────────────────────

export function createMeetSDK(config: DefcommMeetConfig): DefcommMeet {
  return new DefcommMeet(config);
}

export default DefcommMeet;
