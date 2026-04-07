/**
 * @defcomm/calls-sdk
 * Audio call service with priority levels.
 * npm install @defcomm/calls-sdk
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CallPriority = 'routine' | 'important' | 'urgent' | 'emergency';
export type CallMode     = 'one_to_one' | 'group';
export type CallStatus   = 'pending' | 'active' | 'on_hold' | 'ended' | 'missed' | 'declined';
export type CallEvent    = 'call.started' | 'call.ended' | 'call.priority_changed'
                         | 'participant.joined' | 'participant.left' | 'participant.kicked';

export interface CallsConfig {
    serverUrl: string;
    /** Sanctum API token — SERVER SIDE ONLY */
    apiToken?: string;
    onError?: (err: Error) => void;
}

export interface CreateCallOptions {
    /** Human-readable call label */
    title?: string;
    mode: CallMode;
    /** Required for one_to_one — your internal user ID of the callee */
    calleeId?: number | string;
    /**
     * Priority controls how the call behaves for the recipient:
     *   routine   — normal ring, can be declined
     *   important — flagged with visual indicator, logged
     *   urgent    — overrides DND; auto-answers after 30 seconds
     *   emergency — CANNOT be declined; bypasses all restrictions; auto-answers in 5s
     */
    priority: CallPriority;
    /** Short context shown to the callee, e.g. "Security breach — respond now" */
    priorityNote?: string;
    maxParticipants?: number;
    password?: string;
    /** Require host to admit each participant before they hear audio */
    waitingRoom?: boolean;
    /** Join muted (default: true) */
    muteOnJoin?: boolean;
    /** Enable recording */
    recordEnabled?: boolean;
    webhookUrl?: string;
    webhookEvents?: CallEvent[];
}

export interface TokenOptions {
    displayName: string;
    userId?: number | string;
    role?: 'host' | 'participant';
}

export interface EmbedOptions {
    callUid: string;
    token?: string;
    displayName?: string;
    width?: string;
    height?: string;
    onReady?: () => void;
    onEnded?: (reason: string) => void;
    onParticipantJoined?: (p: { peerId: string; displayName: string }) => void;
    onParticipantLeft?: (peerId: string) => void;
    onPriorityChanged?: (priority: CallPriority, note: string | null) => void;
}

export interface CallInfo {
    uid: string; title: string; mode: CallMode; status: CallStatus;
    priority: CallPriority; priorityLabel: string; priorityColor: string; priorityNote: string | null;
    initiatorName: string; calleeName: string | null;
    activeParticipants: number; maxParticipants: number;
    hasPassword: boolean; waitingRoom: boolean; muteOnJoin: boolean;
    startedAt: string | null; endedAt: string | null; durationSeconds: number | null;
    joinUrl: string;
}

export interface Participant {
    peerId: string; displayName: string; role: string;
    isAdmitted: boolean; audioOn: boolean; handRaised: boolean;
    isMutedByHost: boolean; status: string;
    joinedAt: string | null; durationSeconds: number | null;
}

// ─── Priority descriptions (for documentation / UI) ──────────────────────────

export const PRIORITY_INFO: Record<CallPriority, {
    label: string; description: string; canDecline: boolean; autoAnswerSeconds: number | null;
}> = {
    routine: {
        label: 'Routine',
        description: 'Normal call. The recipient can decline or ignore.',
        canDecline: true,
        autoAnswerSeconds: null,
    },
    important: {
        label: 'Important',
        description: 'Flagged call. Visual indicator shown. Logged for audit.',
        canDecline: true,
        autoAnswerSeconds: null,
    },
    urgent: {
        label: 'Urgent',
        description: 'Overrides Do Not Disturb. Auto-answers if recipient does not respond within 30 seconds.',
        canDecline: true,
        autoAnswerSeconds: 30,
    },
    emergency: {
        label: 'Emergency',
        description: 'Cannot be declined. Bypasses all restrictions. Auto-answers within 5 seconds.',
        canDecline: false,
        autoAnswerSeconds: 5,
    },
};

// ─── SDK class ────────────────────────────────────────────────────────────────

export class DefcommCalls {
    private base: string;

    constructor(private readonly config: CallsConfig) {
        this.base = config.serverUrl.replace(/\/$/, '') + '/api/calls';
    }

    // ── Calls ──────────────────────────────────────────────────────────────────

    /**
     * Initiate a call. SERVER SIDE ONLY (uses apiToken).
     *
     * @example
     * // Node.js backend
     * const { call, joinToken } = await calls.create({
     *   mode: 'one_to_one',
     *   calleeId: targetUser.id,
     *   priority: 'urgent',
     *   priorityNote: 'Production outage — need you now',
     *   muteOnJoin: false,
     * });
     * // Send { callUid: call.uid, joinToken } to the caller's frontend
     */
    async create(opts: CreateCallOptions): Promise<{
        call: CallInfo; joinToken: string; joinUrl: string;
    }> {
        const res = await this.req('POST', '/', {
            title:           opts.title,
            mode:            opts.mode,
            callee_id:       opts.calleeId,
            priority:        opts.priority,
            priority_note:   opts.priorityNote,
            max_participants: opts.maxParticipants,
            password:        opts.password,
            waiting_room:    opts.waitingRoom,
            mute_on_join:    opts.muteOnJoin ?? true,
            record_enabled:  opts.recordEnabled,
            webhook_url:     opts.webhookUrl,
            webhook_events:  opts.webhookEvents,
        });
        return {
            call:      this.toCall(res.data.call),
            joinToken: res.data.join_token,
            joinUrl:   res.data.join_url,
        };
    }

    async list(opts: { status?: CallStatus; priority?: CallPriority } = {}): Promise<CallInfo[]> {
        const qs = new URLSearchParams(opts as any).toString();
        const res = await this.req('GET', `/${qs ? '?' + qs : ''}`);
        return res.data.map(this.toCall);
    }

    async get(uid: string): Promise<{ call: CallInfo; participants: Participant[] }> {
        const res = await this.req('GET', `/${uid}`);
        return { call: this.toCall(res.data.call), participants: res.data.participants.map(this.toPart) };
    }

    async end(uid: string): Promise<void> {
        await this.req('DELETE', `/${uid}`);
    }

    // ── Tokens ────────────────────────────────────────────────────────────────

    /**
     * Issue a join token for a participant.
     * SERVER SIDE ONLY. Pass token to your frontend.
     */
    async issueToken(uid: string, opts: TokenOptions): Promise<{
        token: string; joinUrl: string; expiresIn: string;
    }> {
        const res = await this.req('POST', `/${uid}/token`, {
            display_name: opts.displayName,
            user_id:      opts.userId,
            role:         opts.role ?? 'participant',
        });
        return { token: res.data.token, joinUrl: res.data.join_url, expiresIn: res.data.expires_in };
    }

    // ── Participants ──────────────────────────────────────────────────────────

    async listParticipants(uid: string, activeOnly = true): Promise<Participant[]> {
        const res = await this.req('GET', `/${uid}/participants?active_only=${activeOnly}`);
        return res.data.participants.map(this.toPart);
    }

    /** Remove a participant from the call. */
    async kick(uid: string, peerId: string): Promise<void> {
        await this.req('DELETE', `/${uid}/participants/${peerId}`);
    }

    /** Admit a participant from the waiting room. */
    async admit(uid: string, peerId: string): Promise<void> {
        await this.req('POST', `/${uid}/participants/${peerId}/admit`);
    }

    // ── Priority ──────────────────────────────────────────────────────────────

    /**
     * Escalate or change the priority mid-call.
     * All participants receive a priority-changed notification instantly.
     * Upgrading to 'emergency' will apply emergency restrictions immediately.
     */
    async changePriority(uid: string, priority: CallPriority, priorityNote?: string): Promise<CallInfo> {
        const res = await this.req('PATCH', `/${uid}/priority`, {
            priority, priority_note: priorityNote,
        });
        return this.toCall(res.data);
    }

    // ── Embed (browser-safe) ──────────────────────────────────────────────────

    /**
     * Embed the audio call UI in a DOM element as an iframe.
     * No apiToken needed — safe for browser use.
     * Returns a cleanup function.
     *
     * @example
     * const cleanup = calls.embed('#call', {
     *   callUid: 'ac-xxxx-yyyy',
     *   token,
     *   onEnded: () => setCallState('done'),
     *   onPriorityChanged: (p) => updateBanner(p),
     * });
     */
    embed(selector: string | HTMLElement, opts: EmbedOptions): () => void {
        const el = typeof selector === 'string' ? document.querySelector<HTMLElement>(selector) : selector;
        if (!el) throw new Error(`DefcommCalls.embed: "${selector}" not found`);

        const params = new URLSearchParams({ embed: '1' });
        if (opts.token)       params.set('token', opts.token);
        if (opts.displayName) params.set('name',  opts.displayName);

        const iframe = Object.assign(document.createElement('iframe'), {
            src:             `${this.config.serverUrl}/calls/${opts.callUid}?${params}`,
            width:           opts.width  ?? '100%',
            height:          opts.height ?? '480px',
            allow:           'microphone; autoplay',
            allowFullscreen: true,
            style:           'border:none;border-radius:12px;display:block;',
        });

        const origin = new URL(this.config.serverUrl).origin;
        const onMsg  = (e: MessageEvent) => {
            if (e.origin !== origin) return;
            const { type, data } = e.data ?? {};
            if (type === 'call:ready')               opts.onReady?.();
            if (type === 'call:ended')               opts.onEnded?.(data?.reason ?? 'left');
            if (type === 'call:participant-joined')  opts.onParticipantJoined?.(data);
            if (type === 'call:participant-left')    opts.onParticipantLeft?.(data?.peer_id);
            if (type === 'call:priority-changed')    opts.onPriorityChanged?.(data?.priority, data?.priority_note);
        };
        window.addEventListener('message', onMsg);
        el.appendChild(iframe);
        return () => { window.removeEventListener('message', onMsg); el.removeChild(iframe); };
    }

    // ── Static helpers ────────────────────────────────────────────────────────

    static verifyWebhook(body: { call_uid: string; timestamp: number }, sig: string, appKey: string): boolean {
        const crypto = require('crypto');
        const expected = crypto.createHmac('sha256', appKey)
            .update(body.call_uid + String(body.timestamp)).digest('hex');
        return expected === sig;
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private async req(method: string, path: string, body?: object): Promise<any> {
        const res = await fetch(`${this.base}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json', 'Accept': 'application/json',
                ...(this.config.apiToken ? { Authorization: `Bearer ${this.config.apiToken}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(json.message ?? `HTTP ${res.status}`);
            this.config.onError?.(err); throw err;
        }
        return json;
    }

    private toCall = (c: any): CallInfo => ({
        uid: c.uid, title: c.title, mode: c.mode, status: c.status,
        priority: c.priority, priorityLabel: c.priority_label, priorityColor: c.priority_color,
        priorityNote: c.priority_note, initiatorName: c.initiator_name, calleeName: c.callee_name,
        activeParticipants: c.active_participants, maxParticipants: c.max_participants,
        hasPassword: c.has_password, waitingRoom: c.waiting_room, muteOnJoin: c.mute_on_join,
        startedAt: c.started_at, endedAt: c.ended_at, durationSeconds: c.duration_seconds,
        joinUrl: c.join_url,
    });

    private toPart = (p: any): Participant => ({
        peerId: p.peer_id, displayName: p.display_name, role: p.role,
        isAdmitted: p.is_admitted, audioOn: p.audio_on, handRaised: p.hand_raised,
        isMutedByHost: p.is_muted_by_host, status: p.status,
        joinedAt: p.joined_at, durationSeconds: p.duration_seconds,
    });
}

export default DefcommCalls;

/*
════════════════════════════════════════════════════════════════════
DEFCOMM AUDIO CALLS — INTEGRATION GUIDE
════════════════════════════════════════════════════════════════════

PRIORITY SYSTEM
───────────────
Each call has a priority level that controls how it behaves for the recipient.

  routine     Normal ring. Recipient can decline or ignore.
  important   Visual flag + audit log. Recipient can still decline.
  urgent      Overrides Do Not Disturb. Auto-answers in 30 seconds.
              Recipient sees a warning indicator and cannot dismiss the UI.
  emergency   CANNOT be declined. Bypasses all restrictions.
              Auto-answers in 5 seconds if not manually answered.
              The decline button is hidden. This is reserved for security
              incidents, system emergencies, and command-level directives.

Priority can be escalated mid-call (e.g. routine → emergency as a situation develops).
All participants receive a real-time priority-changed notification.

STEP 1  Generate API token
  Settings → API Tokens → New Token
  DEFCOMM_API_TOKEN=sk-...   (never expose in browser)

STEP 2  Install
  npm install @defcomm/calls-sdk

STEP 3  Backend — initiate a call

  import DefcommCalls from '@defcomm/calls-sdk';

  const calls = new DefcommCalls({
    serverUrl: process.env.DEFCOMM_URL,
    apiToken:  process.env.DEFCOMM_API_TOKEN,
  });

  // Direct call to a specific user
  const { call, joinToken } = await calls.create({
    mode:        'one_to_one',
    calleeId:    agent.defcommUserId,
    priority:    'urgent',
    priorityNote:'Production database unreachable — join now',
    muteOnJoin:  false,
    webhookUrl:  'https://yourapp.com/webhooks/defcomm-calls',
    webhookEvents: ['call.ended', 'participant.joined'],
  });

  // Send joinToken + call.uid to caller's frontend
  res.json({ callUid: call.uid, token: joinToken, joinUrl: call.joinUrl });

STEP 4  Frontend — embed the call UI

  const cleanup = calls.embed('#call', {
    callUid: callUid,
    token:   joinToken,
    onReady:           () => setStatus('live'),
    onEnded:           (reason) => navigate('/dashboard'),
    onPriorityChanged: (p, note) => showBanner(`Priority escalated to ${p}: ${note}`),
  });
  // cleanup() when component unmounts

STEP 5  Receive webhooks

  app.post('/webhooks/defcomm-calls', (req, res) => {
    const body = JSON.parse(req.body);
    if (!DefcommCalls.verifyWebhook(body, req.headers['x-defcomm-signature'], APP_KEY)) {
      return res.sendStatus(401);
    }
    switch (body.event) {
      case 'call.ended':
        await db.updateIncident(body.call_uid, { resolved: true, duration: body.payload.duration_seconds });
        break;
      case 'call.priority_changed':
        await notifyOps(`Call ${body.call_uid} escalated to ${body.payload.new}`);
        break;
      case 'participant.joined':
        await audit.log('call_join', body);
        break;
    }
    res.sendStatus(200);
  });

STEP 6  Manage calls programmatically

  // Escalate priority mid-call
  await calls.changePriority(uid, 'emergency', 'Active breach detected');

  // Remove a participant
  await calls.kick(uid, peerId);

  // Admit from waiting room
  await calls.admit(uid, peerId);

  // End the call
  await calls.end(uid);

  // List active participants
  const participants = await calls.listParticipants(uid);

API REFERENCE   (Bearer token required, Base: /api/calls)
════════════════════════════════════════════════════════════════════
GET    /                              list() — all calls
POST   /                              create() — initiate call
GET    /{uid}                         get() — call details + participants
DELETE /{uid}                         end() — terminate for all
POST   /{uid}/token                   issueToken() — join token
GET    /{uid}/participants            listParticipants()
DELETE /{uid}/participants/{peerId}   kick()
POST   /{uid}/participants/{peerId}/admit  admit()
PATCH  /{uid}/priority               changePriority()

WEBHOOK EVENTS
  call.started          call became active
  call.ended            call ended
  call.priority_changed priority escalated or downgraded
  participant.joined    participant admitted and connected
  participant.left      participant left voluntarily
  participant.kicked    participant removed by host
════════════════════════════════════════════════════════════════════
*/
