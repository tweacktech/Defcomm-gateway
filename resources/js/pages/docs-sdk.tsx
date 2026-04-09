// resources/js/pages/docs/sdk.tsx
// Route: GET /docs/sdk  (auth middleware)
// Inertia::render('docs/sdk')

import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef, ReactNode } from 'react';
import {
    Video, Phone, Shield, Code2, Key, Zap, Book,
    ChevronRight, Copy, Check, ExternalLink, AlertTriangle,
    Info, Lightbulb, Terminal, Globe, Lock, Webhook,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Docs', href: '/docs' },
    { title: 'SDK Reference', href: '/docs/sdk' },
];

// ─── Design tokens (consistent with app dark theme) ──────────────────────────

const C = {
    meet:  { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', dot: 'bg-emerald-400' },
    calls: { text: 'text-pink-400',    bg: 'bg-pink-400/10',    border: 'border-pink-400/30',    dot: 'bg-pink-400' },
    cyan:  { text: 'text-cyan-400',    bg: 'bg-cyan-400/10',    border: 'border-cyan-400/30',    dot: 'bg-cyan-400' },
    warn:  { text: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/30' },
    info:  { text: 'text-sky-400',     bg: 'bg-sky-400/10',     border: 'border-sky-400/30' },
    tip:   { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
};

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV = [
    { label: 'Getting Started', items: [
        { id: 'overview',     label: 'Overview',         color: C.cyan },
        { id: 'installation', label: 'Installation',     color: C.cyan },
        { id: 'auth',         label: 'Authentication',   color: C.cyan },
    ]},
    { label: 'Meet SDK',  items: [
        { id: 'meet-quick',    label: 'Quick Start',  color: C.meet },
        { id: 'meet-api',      label: 'API Reference', color: C.meet },
        { id: 'meet-embed',    label: 'Embed Options', color: C.meet },
        { id: 'meet-events',   label: 'Events',        color: C.meet },
        { id: 'meet-webhooks', label: 'Webhooks',      color: C.meet },
    ]},
    { label: 'Calls SDK', items: [
        { id: 'calls-quick',    label: 'Quick Start',     color: C.calls },
        { id: 'calls-priority', label: 'Priority System', color: C.calls },
        { id: 'calls-api',      label: 'API Reference',   color: C.calls },
        { id: 'calls-embed',    label: 'Embed Options',   color: C.calls },
        { id: 'calls-events',   label: 'Events',          color: C.calls },
    ]},
    { label: 'Reference', items: [
        { id: 'webhooks',  label: 'Webhook Verification', color: C.cyan },
        { id: 'channels',  label: 'Broadcast Channels',   color: C.cyan },
        { id: 'recipes',   label: 'Recipes',              color: C.cyan },
    ]},
];

// ─── Utility components ───────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-300">
            {copied ? <><Check className="h-3 w-3 text-emerald-400" />Copied</> : <><Copy className="h-3 w-3" />Copy</>}
        </button>
    );
}

function CodeBlock({ title, lang, code }: { title?: string; lang: string; code: string }) {
    return (
        <div className="my-5 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            {title && (
                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
                    <span className="font-mono text-[11px] font-medium text-zinc-400">{title}</span>
                    <div className="flex items-center gap-2">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-500">{lang}</span>
                        <CopyButton text={code} />
                    </div>
                </div>
            )}
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-zinc-300 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700">
                <code>{code}</code>
            </pre>
        </div>
    );
}

function Callout({ type, children }: { type: 'warn' | 'info' | 'tip'; children: ReactNode }) {
    const cfg = { warn: { ...C.warn, icon: AlertTriangle, label: 'Warning' },
                  info: { ...C.info, icon: Info, label: 'Note' },
                  tip:  { ...C.tip,  icon: Lightbulb, label: 'Tip' } }[type];
    const Icon = cfg.icon;
    return (
        <div className={`my-5 flex gap-3 rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.text}`} />
            <p className={`text-sm leading-relaxed ${cfg.text}`}>{children}</p>
        </div>
    );
}

function SectionTitle({ tag, title, desc, color = 'text-cyan-400' }: { tag: string; title: string; desc?: string; color?: string }) {
    return (
        <div className="mb-8">
            <p className={`mb-2 text-[10px] font-bold uppercase tracking-[2px] ${color}`}>{tag}</p>
            <h2 className="mb-3 font-mono text-2xl font-bold tracking-tight text-white">{title}</h2>
            {desc && <p className="max-w-xl text-sm leading-relaxed text-zinc-400">{desc}</p>}
        </div>
    );
}

function ApiRow({ method, path, fn, desc }: { method: string; path: string; fn: string; desc: string }) {
    const mc: Record<string, string> = {
        GET:    'bg-emerald-500/15 text-emerald-400',
        POST:   'bg-sky-500/15 text-sky-400',
        PATCH:  'bg-amber-500/15 text-amber-400',
        DELETE: 'bg-red-500/15 text-red-400',
    };
    return (
        <tr className="border-b border-zinc-800/50 transition hover:bg-zinc-800/20">
            <td className="py-3 pr-3">
                <code className="text-[11px] font-mono text-cyan-300">{fn}</code>
            </td>
            <td className="py-3 pr-3">
                <span className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${mc[method] ?? ''}`}>{method}</span>
            </td>
            <td className="py-3 pr-3">
                <code className="font-mono text-[11px] text-zinc-300">{path}</code>
            </td>
            <td className="py-3 text-[12px] text-zinc-400">{desc}</td>
        </tr>
    );
}

function EventCard({ name, cls, desc }: { name: string; cls: string; desc: string }) {
    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700">
            <code className="block font-mono text-[11px] font-bold text-cyan-400 mb-1">{name}</code>
            <code className="block font-mono text-[10px] text-zinc-500 mb-2">{cls}</code>
            <p className="text-[12px] leading-relaxed text-zinc-400">{desc}</p>
        </div>
    );
}

type PriorityLevel = 'routine' | 'important' | 'urgent' | 'emergency';
function PriorityCard({ level, badge, title, desc }: { level: PriorityLevel; badge: string; title: string; desc: string }) {
    const styles: Record<PriorityLevel, string> = {
        routine:   'border-zinc-700   bg-zinc-800/30  text-zinc-300',
        important: 'border-sky-500/30 bg-sky-500/5    text-sky-300',
        urgent:    'border-amber-500/30 bg-amber-500/5  text-amber-300',
        emergency: 'border-red-500/30 bg-red-500/5    text-red-300',
    };
    const badgeStyle: Record<PriorityLevel, string> = {
        routine:   'bg-zinc-700 text-zinc-400',
        important: 'bg-sky-500/20 text-sky-400',
        urgent:    'bg-amber-500/20 text-amber-400',
        emergency: 'bg-red-500/20 text-red-400',
    };
    return (
        <div className={`rounded-xl border p-5 ${styles[level]}`}>
            <span className={`mb-3 inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest ${badgeStyle[level]}`}>{badge}</span>
            <h4 className="mb-2 font-mono text-base font-bold">{title}</h4>
            <p className="text-[12px] leading-relaxed opacity-80">{desc}</p>
        </div>
    );
}

// Tabbed code example
function Tabs({ tabs }: { tabs: { label: string; code: string; lang: string; title?: string }[] }) {
    const [active, setActive] = useState(0);
    return (
        <div className="my-5 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <div className="flex border-b border-zinc-800">
                {tabs.map((t, i) => (
                    <button key={i} onClick={() => setActive(i)}
                        className={`px-4 py-2.5 font-mono text-[11px] font-medium transition ${active === i ? 'border-b-2 border-cyan-400 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        {t.label}
                    </button>
                ))}
            </div>
            <div className="flex items-center justify-between bg-zinc-900/40 px-4 py-1.5 border-b border-zinc-800">
                <span className="font-mono text-[10px] text-zinc-500">{tabs[active].title ?? ''}</span>
                <div className="flex items-center gap-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-zinc-600">{tabs[active].lang}</span>
                    <CopyButton text={tabs[active].code} />
                </div>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-zinc-300 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700">
                <code>{tabs[active].code}</code>
            </pre>
        </div>
    );
}

// ─── Page sections ────────────────────────────────────────────────────────────

function SectionOverview() {
    return (
        <section id="overview" className="scroll-mt-8 border-b border-zinc-800/60 pb-16">
            <SectionTitle tag="Introduction" title="Two services, one platform" color="text-cyan-400"
                desc="Defcomm provides two independent real-time communication services, each with its own SDK. All media travels peer-to-peer via WebRTC — nothing passes through Defcomm servers." />

            <div className="grid grid-cols-2 gap-4">
                {[
                    { icon: Video, label: '@defcomm/meet-sdk', title: 'Defcomm Meet', pkg: C.meet,
                      desc: 'Video & audio conferencing. Screen sharing, recording, waiting rooms, chat. Up to 200 participants per room.' },
                    { icon: Phone, label: '@defcomm/calls-sdk', title: 'Defcomm Calls', pkg: C.calls,
                      desc: 'Audio-only calls with a four-tier priority system. Emergency calls bypass all restrictions and cannot be declined.' },
                ].map(s => (
                    <div key={s.title} className={`cursor-pointer rounded-2xl border p-6 transition hover:-translate-y-0.5 hover:shadow-xl ${s.pkg.bg} ${s.pkg.border}`}>
                        <s.icon className={`mb-4 h-7 w-7 ${s.pkg.text}`} />
                        <h3 className="mb-1 font-mono text-base font-bold text-white">{s.title}</h3>
                        <code className={`mb-3 block font-mono text-[11px] ${s.pkg.text}`}>{s.label}</code>
                        <p className="text-[13px] leading-relaxed text-zinc-400">{s.desc}</p>
                    </div>
                ))}
            </div>

            <Callout type="info">
                All media (audio/video) travels peer-to-peer via WebRTC and never passes through Defcomm servers. The server only handles signaling, presence, and metadata.
            </Callout>
        </section>
    );
}

function SectionInstallation() {
    return (
        <section id="installation" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Setup" title="Installation" color="text-cyan-400" />

            <CodeBlock lang="bash" title="Terminal" code={`# Install one or both SDKs
npm install @defcomm/meet-sdk
npm install @defcomm/calls-sdk`} />

            <div className="space-y-0 divide-y divide-zinc-800/50">
                {[
                    { n: '1', title: 'Generate an API token',
                      body: 'In your Defcomm dashboard: Settings → API Tokens → New Token. Copy the value immediately — it is shown only once.',
                      code: `DEFCOMM_URL=https://meet.yourcompany.com\nDEFCOMM_API_TOKEN=sk-1234abcd...\nDEFCOMM_APP_KEY=your-laravel-app-key   # for webhook verification`,
                      lang: 'env', file: '.env' },
                    { n: '2', title: 'Initialize on your server',
                      body: 'Create a shared SDK instance on your backend. The apiToken must never appear in browser code.',
                      code: `import DefcommMeet  from '@defcomm/meet-sdk';\nimport DefcommCalls from '@defcomm/calls-sdk';\n\nexport const meet = new DefcommMeet({\n  serverUrl: process.env.DEFCOMM_URL,\n  apiToken:  process.env.DEFCOMM_API_TOKEN,\n});\n\nexport const calls = new DefcommCalls({\n  serverUrl: process.env.DEFCOMM_URL,\n  apiToken:  process.env.DEFCOMM_API_TOKEN,\n});`,
                      lang: 'ts', file: 'lib/defcomm.ts' },
                ].map(step => (
                    <div key={step.n} className="grid grid-cols-[44px_1fr] gap-4 py-8">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 font-mono text-sm font-bold text-cyan-400 mt-1">{step.n}</div>
                        <div>
                            <h4 className="mb-1 font-mono text-[15px] font-bold text-white">{step.title}</h4>
                            <p className="mb-0 text-sm leading-relaxed text-zinc-400">{step.body}</p>
                            <CodeBlock lang={step.lang} title={step.file} code={step.code} />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function SectionAuth() {
    return (
        <section id="auth" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Authentication" title="Tokens & security model" color="text-cyan-400"
                desc="Defcomm uses a two-token model: a long-lived API token for server operations, and short-lived 2-hour join tokens for participants." />

            <Callout type="warn">
                The <strong>API token</strong> must only be used on your server. If exposed in browser code, anyone can create rooms, end calls, and access recordings under your account.
            </Callout>

            <CodeBlock title="Token flow" lang="ts" code={`// ① Your server creates a resource and issues a join token
const { room, joinToken } = await meet.createRoom({ name: 'Q3 Planning' });
const { token } = await meet.issueToken(room.uid, {
  displayName: user.name,
  userId:      user.id,
  role:        'participant',  // 'host' | 'co-host' | 'participant' | 'viewer'
});

// ② Send token + roomUid to your frontend (never the API token!)
res.json({ roomUid: room.uid, token });

// ③ Frontend embeds the room — no API token required
const sdk = new DefcommMeet({ serverUrl: DEFCOMM_URL });
const cleanup = sdk.embed('#room', { roomUid, token });`} />
        </section>
    );
}

function SectionMeetQuick() {
    return (
        <section id="meet-quick" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Meet SDK" title="Quick start" color={C.meet.text} />
            <Tabs tabs={[
                { label: 'Server', lang: 'ts', title: 'api/meeting.ts', code:
`import { meet } from './lib/defcomm';

app.post('/api/meeting/start', async (req, res) => {
  const { room, joinToken } = await meet.createRoom({
    name:             'Support Call #' + req.body.ticketId,
    waitingRoom:      true,
    recordingEnabled: true,
    webhookUrl:       'https://yourapp.com/webhooks/meet',
    webhookEvents:    ['room.started', 'room.ended', 'recording.ready'],
  });

  const { token: participantToken } = await meet.issueToken(room.uid, {
    displayName: req.user.name,
    userId:      req.user.id,
    role:        'participant',
  });

  res.json({ roomUid: room.uid, hostToken: joinToken, participantToken });
});` },
                { label: 'React', lang: 'tsx', title: 'components/Meeting.tsx', code:
`import { useEffect } from 'react';
import DefcommMeet from '@defcomm/meet-sdk';

export function Meeting({ roomUid, token }: { roomUid: string; token: string }) {
  useEffect(() => {
    const sdk = new DefcommMeet({ serverUrl: process.env.NEXT_PUBLIC_DEFCOMM_URL });
    return sdk.embed('#meeting', {
      roomUid,
      token,
      onReady:             () => console.log('Meeting is live'),
      onEnded:             (reason) => router.push('/dashboard'),
      onParticipantJoined: ({ displayName }) => toast(displayName + ' joined'),
      onParticipantLeft:   (peerId) => console.log(peerId, 'left'),
    });
  }, [roomUid, token]);

  return <div id="meeting" style={{ height: 600 }} />;
}` },
                { label: 'Vanilla JS', lang: 'js', title: 'meeting.js', code:
`import DefcommMeet from '@defcomm/meet-sdk';

const sdk = new DefcommMeet({ serverUrl: 'https://meet.yourcompany.com' });
const cleanup = sdk.embed(document.getElementById('meeting-container'), {
  roomUid: ROOM_UID,   // from your server
  token:   JOIN_TOKEN, // from your server
  onEnded: (reason) => {
    if (reason === 'room-ended') showSummaryScreen();
    else redirectHome();
  },
});

// When navigating away:
cleanup();` },
            ]} />
        </section>
    );
}

function SectionMeetApi() {
    const rows = [
        { method: 'POST',   path: '/api/meet/rooms',                                  fn: 'createRoom(opts)',           desc: 'Create a room. Returns room + host join token.' },
        { method: 'GET',    path: '/api/meet/rooms',                                  fn: 'listRooms(status?)',          desc: 'List all rooms. Optional status filter.' },
        { method: 'GET',    path: '/api/meet/rooms/{uid}',                            fn: 'getRoom(uid)',               desc: 'Room details + active participants.' },
        { method: 'PATCH',  path: '/api/meet/rooms/{uid}',                            fn: 'updateRoom(uid, updates)',   desc: 'Update name, max participants, waiting room, webhook.' },
        { method: 'DELETE', path: '/api/meet/rooms/{uid}',                            fn: 'endRoom(uid)',               desc: 'End room. Triggers room.ended webhook.' },
        { method: 'POST',   path: '/api/meet/rooms/{uid}/token',                      fn: 'issueToken(uid, opts)',      desc: 'Issue a 2-hour join token for a participant.' },
        { method: 'GET',    path: '/api/meet/rooms/{uid}/participants',               fn: 'listParticipants(uid)',      desc: 'Active or all participants.' },
        { method: 'DELETE', path: '/api/meet/rooms/{uid}/participants/{peerId}',      fn: 'kickParticipant(uid, id)',   desc: 'Remove a participant from the room.' },
        { method: 'POST',   path: '/api/meet/rooms/{uid}/participants/{peerId}/admit',fn: 'admitParticipant(uid, id)', desc: 'Admit from waiting room.' },
        { method: 'GET',    path: '/api/meet/rooms/{uid}/recordings',                 fn: 'listRecordings(uid)',        desc: 'List recordings with download URLs.' },
        { method: 'DELETE', path: '/api/meet/rooms/{uid}/recordings/{id}',            fn: 'deleteRecording(uid, id)',   desc: 'Delete a recording file.' },
    ];
    return (
        <section id="meet-api" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Meet SDK" title="API reference" color={C.meet.text} />
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left">
                    <thead className="border-b border-zinc-800 bg-zinc-900/60">
                        <tr>{['Method', 'HTTP', 'Endpoint', 'Description'].map(h => (
                            <th key={h} className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">{h}</th>
                        ))}</tr>
                    </thead>
                    <tbody>{rows.map((r, i) => <ApiRow key={i} {...r} />)}</tbody>
                </table>
            </div>
        </section>
    );
}

function SectionMeetEmbed() {
    const opts = [
        { opt: 'roomUid',             type: 'string',         desc: 'Room UID from createRoom().' },
        { opt: 'token',               type: 'string?',        desc: 'Join token from issueToken(). Required for password-protected or waiting-room rooms.' },
        { opt: 'displayName',         type: 'string?',        desc: 'Fallback display name if no token is provided.' },
        { opt: 'width / height',      type: 'string?',        desc: "iframe dimensions. Default: '100%' / '600px'." },
        { opt: 'onReady',             type: '() => void',     desc: 'Fires when the room is live and the participant is connected.' },
        { opt: 'onEnded(reason)',     type: '(string) => void', desc: "Fires on leave or room end. Reason: 'left' | 'kicked' | 'room-ended'." },
        { opt: 'onParticipantJoined', type: '({peerId, displayName}) => void', desc: 'A new participant joined.' },
        { opt: 'onParticipantLeft',   type: '(string) => void', desc: 'A participant left — passes peerId.' },
    ];
    return (
        <section id="meet-embed" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Meet SDK" title="meet.embed() options" color={C.meet.text} />
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left">
                    <thead className="border-b border-zinc-800 bg-zinc-900/60">
                        <tr>{['Option', 'Type', 'Description'].map(h => (
                            <th key={h} className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">{h}</th>
                        ))}</tr>
                    </thead>
                    <tbody>{opts.map((r, i) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                            <td className="px-4 py-3"><code className="font-mono text-[11px] text-cyan-300">{r.opt}</code></td>
                            <td className="px-4 py-3"><code className="font-mono text-[11px] text-emerald-300">{r.type}</code></td>
                            <td className="px-4 py-3 text-[12px] text-zinc-400">{r.desc}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </section>
    );
}

function SectionMeetEvents() {
    const events = [
        { name: '.meet.participant-joined',   cls: 'ParticipantJoined.php',        desc: 'Fires when a participant is admitted. Also fires to the participant themselves when admitted from the waiting room.' },
        { name: '.meet.participant-left',     cls: 'ParticipantLeft.php',          desc: 'Fires when any participant leaves, is kicked, or is auto-removed.' },
        { name: '.meet.participant-waiting',  cls: 'ParticipantWaiting.php',       desc: 'Fires to the host when a participant is waiting for admission (waiting_room=true).' },
        { name: '.meet.signal',              cls: 'SignalSent.php',               desc: 'WebRTC signaling envelope (offer/answer/ICE). Routes to the specific peer by peer_id.' },
        { name: '.meet.room-ended',          cls: 'RoomEnded.php',                desc: 'Fires to all participants when the host ends the room.' },
        { name: '.meet.participant-kicked',  cls: 'ParticipantKicked.php',        desc: 'Fires to all when a participant is kicked. The kicked peer detects their own peer_id.' },
        { name: '.meet.media-updated',       cls: 'ParticipantMediaUpdated.php',  desc: 'Camera, mic, screen share, and hand raise state changes from any participant.' },
        { name: '.meet.recording-started',   cls: 'RecordingStarted.php',         desc: 'Host started recording. All participants see the REC badge.' },
        { name: '.meet.recording-stopped',   cls: 'RecordingStopped.php',         desc: 'Host stopped recording.' },
    ];
    return (
        <section id="meet-events" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Meet SDK" title="Broadcast events" color={C.meet.text}
                desc="All events broadcast on presence channel meet.{uid} via Laravel Reverb. Channel: presence-meet.{uid}" />
            <div className="grid grid-cols-2 gap-3">
                {events.map(e => <EventCard key={e.name} {...e} />)}
            </div>
        </section>
    );
}

function SectionMeetWebhooks() {
    return (
        <section id="meet-webhooks" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Meet SDK" title="Webhooks" color={C.meet.text} />
            <CodeBlock title="Webhook handler (Express)" lang="ts" code={`import DefcommMeet from '@defcomm/meet-sdk';

app.post('/webhooks/meet', express.raw({ type: '*/*' }), (req, res) => {
  const body = JSON.parse(req.body.toString());
  const sig  = req.headers['x-defcomm-signature'];

  if (!DefcommMeet.verifyWebhook(body, sig, process.env.DEFCOMM_APP_KEY)) {
    return res.sendStatus(401);
  }

  switch (body.event) {
    case 'room.started':
      await db.meetings.update(body.room_uid, { status: 'active' });
      break;
    case 'room.ended':
      await db.meetings.update(body.room_uid, {
        status:   'ended',
        ended_at: body.payload.ended_at,
      });
      break;
    case 'recording.ready':
      await notifyHost(body.payload.download_url);
      break;
  }
  res.sendStatus(200);
});`} />
            <p className="mt-4 text-[12px] text-zinc-500">
                Available events: <code className="text-xs text-zinc-300">room.started</code> · <code className="text-xs text-zinc-300">room.ended</code> · <code className="text-xs text-zinc-300">participant.joined</code> · <code className="text-xs text-zinc-300">participant.left</code> · <code className="text-xs text-zinc-300">participant.kicked</code> · <code className="text-xs text-zinc-300">recording.started</code> · <code className="text-xs text-zinc-300">recording.ready</code>
            </p>
        </section>
    );
}

function SectionCallsQuick() {
    return (
        <section id="calls-quick" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Calls SDK" title="Quick start" color={C.calls.text} />
            <Tabs tabs={[
                { label: 'Server', lang: 'ts', title: 'api/calls.ts', code:
`import { calls } from './lib/defcomm';

app.post('/api/call/start', async (req, res) => {
  const { call, joinToken } = await calls.create({
    mode:         'one_to_one',
    calleeId:     req.body.userId,
    priority:     'urgent',
    priorityNote: 'Production DB down — need you now',
    muteOnJoin:   false,
    webhookUrl:   'https://yourapp.com/webhooks/calls',
  });

  const { token: calleeToken } = await calls.issueToken(call.uid, {
    displayName: targetUser.name,
    userId:      targetUser.id,
    role:        'participant',
  });

  res.json({ callUid: call.uid, callerToken: joinToken, calleeToken });
});` },
                { label: 'Frontend', lang: 'tsx', title: 'components/Call.tsx', code:
`import DefcommCalls from '@defcomm/calls-sdk';

export function CallEmbed({ callUid, token }) {
  useEffect(() => {
    const sdk = new DefcommCalls({ serverUrl: DEFCOMM_URL });
    return sdk.embed('#call', {
      callUid,
      token,
      onReady:           () => setStatus('live'),
      onEnded:           (reason) => setView('done'),
      onPriorityChanged: (priority, note) => {
        showBanner('Priority escalated: ' + priority + ' — ' + note);
      },
    });
  }, [callUid, token]);

  return <div id="call" style={{ height: 480 }} />;
}` },
                { label: 'Incoming Ring', lang: 'tsx', title: 'IncomingCallHandler.tsx', code:
`// Mount in your root layout to receive incoming calls globally.
// Listens on private Reverb channel: user.{id}

export function IncomingCallHandler({ userId }) {
  const [incoming, setIncoming] = useState(null);

  useEffect(() => {
    const echo = new Echo({ broadcaster: 'reverb', ... });
    echo.private('user.' + userId)
      .listen('.call.initiated', (data) => {
        setIncoming(data);
        // Emergency: auto-answer in 5s
        if (data.priority === 'emergency')
          setTimeout(() => answerCall(data.uid), 5000);
      });
    return () => echo.leave('user.' + userId);
  }, [userId]);

  if (!incoming) return null;
  return (
    <IncomingCallToast
      call={incoming}
      onAnswer={() => router.push('/calls/' + incoming.uid)}
      onDecline={() => axios.post('/calls/' + incoming.uid + '/decline')}
    />
  );
}` },
            ]} />
        </section>
    );
}

function SectionCallsPriority() {
    return (
        <section id="calls-priority" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Calls SDK" title="Priority system" color={C.calls.text}
                desc="Every call has a priority that controls how the callee experiences the incoming ring. Priority can be escalated mid-call in real time." />
            <div className="grid grid-cols-2 gap-4 mb-6">
                <PriorityCard level="routine"   badge="P0" title="Routine"
                    desc="Normal ring. Callee can decline or ignore. For planned check-ins and non-urgent matters." />
                <PriorityCard level="important" badge="P1" title="Important"
                    desc="Visual flag shown. Call is logged for audit. Callee can still decline. Use for escalations needing attention within the hour." />
                <PriorityCard level="urgent"    badge="P2" title="Urgent"
                    desc="Overrides Do Not Disturb. Auto-answers after 30 seconds if no response. Cannot be snoozed or dismissed." />
                <PriorityCard level="emergency" badge="P3" title="Emergency"
                    desc="Cannot be declined. Decline button is hidden. Auto-answers in 5 seconds. Bypasses all restrictions. Reserved for critical incidents only." />
            </div>
            <Callout type="warn">
                Use Emergency priority sparingly. Overuse desensitises recipients and undermines the trust model. Reserve it for situations requiring an immediate human response regardless of context.
            </Callout>
            <CodeBlock title="Escalate priority mid-call" lang="ts" code={`// A routine check-in escalates when an incident is detected
await calls.changePriority(callUid, 'emergency', 'Active breach detected on prod-db-01');

// All participants' UIs update instantly:
// — Priority bar changes colour
// — Note appears as a banner
// — Unanswered callee gets the emergency overlay with 5s auto-answer`} />
        </section>
    );
}

function SectionCallsApi() {
    const rows = [
        { method: 'POST',   path: '/api/calls',                                   fn: 'create(opts)',              desc: 'Initiate a call. Returns call + host join token.' },
        { method: 'GET',    path: '/api/calls',                                   fn: 'list(opts?)',               desc: 'List calls. Filter by status or priority.' },
        { method: 'GET',    path: '/api/calls/{uid}',                             fn: 'get(uid)',                  desc: 'Call details + active participants.' },
        { method: 'DELETE', path: '/api/calls/{uid}',                             fn: 'end(uid)',                  desc: 'End call for everyone.' },
        { method: 'POST',   path: '/api/calls/{uid}/token',                       fn: 'issueToken(uid, opts)',     desc: 'Issue a 2-hour join token.' },
        { method: 'GET',    path: '/api/calls/{uid}/participants',                fn: 'listParticipants(uid)',     desc: 'Active or all participants.' },
        { method: 'DELETE', path: '/api/calls/{uid}/participants/{peerId}',       fn: 'kick(uid, peerId)',         desc: 'Remove a participant.' },
        { method: 'POST',   path: '/api/calls/{uid}/participants/{peerId}/admit', fn: 'admit(uid, peerId)',        desc: 'Admit from waiting room.' },
        { method: 'PATCH',  path: '/api/calls/{uid}/priority',                   fn: 'changePriority(uid, p)',    desc: 'Escalate or change priority. Broadcasts to all participants instantly.' },
    ];
    return (
        <section id="calls-api" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Calls SDK" title="API reference" color={C.calls.text} />
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left">
                    <thead className="border-b border-zinc-800 bg-zinc-900/60">
                        <tr>{['Method', 'HTTP', 'Endpoint', 'Description'].map(h => (
                            <th key={h} className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">{h}</th>
                        ))}</tr>
                    </thead>
                    <tbody>{rows.map((r, i) => <ApiRow key={i} {...r} />)}</tbody>
                </table>
            </div>
        </section>
    );
}

function SectionCallsEmbed() {
    const opts = [
        { opt: 'callUid',             type: 'string',           desc: 'Call UID from create().' },
        { opt: 'token',               type: 'string?',          desc: 'Join token from issueToken().' },
        { opt: 'displayName',         type: 'string?',          desc: 'Fallback display name if no token.' },
        { opt: 'width / height',      type: 'string?',          desc: "iframe dimensions. Default: '100%' / '480px'." },
        { opt: 'onReady',             type: '() => void',       desc: 'Fires when audio is connected and the call is live.' },
        { opt: 'onEnded(reason)',     type: '(string) => void', desc: "Reason: 'left' | 'kicked' | 'call-ended' | 'declined'." },
        { opt: 'onPriorityChanged',   type: '(priority, note) => void', desc: 'Priority was escalated or changed mid-call.' },
        { opt: 'onParticipantJoined', type: '({peerId, displayName}) => void', desc: 'New participant joined.' },
        { opt: 'onParticipantLeft',   type: '(peerId) => void', desc: 'Participant left.' },
    ];
    return (
        <section id="calls-embed" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Calls SDK" title="calls.embed() options" color={C.calls.text} />
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left">
                    <thead className="border-b border-zinc-800 bg-zinc-900/60">
                        <tr>{['Option', 'Type', 'Description'].map(h => (
                            <th key={h} className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">{h}</th>
                        ))}</tr>
                    </thead>
                    <tbody>{opts.map((r, i) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                            <td className="px-4 py-3"><code className="font-mono text-[11px] text-pink-300">{r.opt}</code></td>
                            <td className="px-4 py-3"><code className="font-mono text-[11px] text-emerald-300">{r.type}</code></td>
                            <td className="px-4 py-3 text-[12px] text-zinc-400">{r.desc}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </section>
    );
}

function SectionCallsEvents() {
    const events = [
        { name: '.call.initiated',          cls: 'CallInitiated.php',           desc: "Broadcast to the callee's personal channel. Triggers the ring notification. Contains priority + priority_note." },
        { name: '.call.answered',           cls: 'CallAnswered.php',            desc: 'Callee answered the call. Fires to the caller\'s presence channel.' },
        { name: '.call.declined',           cls: 'CallDeclined.php',            desc: 'Callee declined. Not fired for emergency priority calls — those cannot be declined.' },
        { name: '.call.ended',              cls: 'CallEnded.php',               desc: 'Call ended by host or became empty. Includes reason and duration_seconds.' },
        { name: '.call.priority-changed',   cls: 'CallPriorityChanged.php',     desc: 'Priority escalated or downgraded mid-call. All UIs update instantly with new colour and banner.' },
        { name: '.call.signal',             cls: 'CallSignalSent.php',          desc: 'WebRTC signaling (offer/answer/ICE). Routes by peer_id — only the target peer processes it.' },
        { name: '.call.participant-joined', cls: 'ParticipantJoinedCall.php',   desc: 'Fires to all when admitted. Also fires to the participant themselves when admitted from waiting room.' },
        { name: '.call.participant-left',   cls: 'ParticipantLeftCall.php',     desc: 'Participant left voluntarily. Includes duration_seconds.' },
        { name: '.call.participant-kicked', cls: 'ParticipantKickedFromCall.php', desc: 'Host removed a participant. The kicked peer detects their own peer_id.' },
        { name: '.call.participant-muted',  cls: 'ParticipantMuted.php',        desc: 'Mic toggled. Includes by_host flag — if true, the participant cannot unmute themselves.' },
        { name: '.call.participant-waiting',cls: 'CallWaiting.php',             desc: 'Participant is in the waiting room. Only the host receives this event.' },
    ];
    return (
        <section id="calls-events" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Calls SDK" title="Broadcast events" color={C.calls.text}
                desc="All events on presence channel call.{uid}. Incoming ring fires on private channel user.{id}." />
            <div className="grid grid-cols-2 gap-3">
                {events.map(e => <EventCard key={e.name} {...e} />)}
            </div>
        </section>
    );
}

function SectionWebhooks() {
    return (
        <section id="webhooks" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Reference" title="Webhook verification" color="text-cyan-400"
                desc="Every webhook request from Defcomm includes an X-Defcomm-Signature header. Verify it using your app key to prevent spoofing." />
            <CodeBlock title="Verification (Node.js)" lang="ts" code={`import crypto from 'crypto';

function verifyWebhook(
  body: { room_uid?: string; call_uid?: string; timestamp: number },
  signature: string,
  appKey: string,
): boolean {
  const uid      = body.room_uid ?? body.call_uid ?? '';
  const expected = crypto
    .createHmac('sha256', appKey)
    .update(uid + String(body.timestamp))
    .digest('hex');
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
}`} />
            <Callout type="tip">
                Both SDKs expose <code>DefcommMeet.verifyWebhook()</code> and <code>DefcommCalls.verifyWebhook()</code> as static methods that handle this for you — including the timing-safe comparison.
            </Callout>
        </section>
    );
}

function SectionChannels() {
    const rows = [
        { channel: 'meet.{uid}',  type: 'Presence', desc: 'All Meet room events. Auth via /broadcasting/auth.' },
        { channel: 'call.{uid}',  type: 'Presence', desc: 'All Call events. Auth via /broadcasting/auth.' },
        { channel: 'user.{id}',   type: 'Private',  desc: 'Incoming call notifications sent to a specific user.' },
    ];
    return (
        <section id="channels" className="scroll-mt-8 border-b border-zinc-800/60 py-16">
            <SectionTitle tag="Reference" title="Broadcast channels" color="text-cyan-400" />
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left">
                    <thead className="border-b border-zinc-800 bg-zinc-900/60">
                        <tr>{['Channel', 'Type', 'Used by'].map(h => (
                            <th key={h} className="px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">{h}</th>
                        ))}</tr>
                    </thead>
                    <tbody>{rows.map((r, i) => (
                        <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                            <td className="px-4 py-3"><code className="font-mono text-[11px] text-cyan-300">{r.channel}</code></td>
                            <td className="px-4 py-3"><span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-400">{r.type}</span></td>
                            <td className="px-4 py-3 text-[12px] text-zinc-400">{r.desc}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            <Callout type="info">
                Presence channels require <code>BroadcastServiceProvider</code> to use <code>middleware=['web']</code> only — not <code>auth</code> — so that guest participants can authorize. Guest identity is verified via session set by <code>MeetController::guestJoin()</code>.
            </Callout>
        </section>
    );
}

function SectionRecipes() {
    return (
        <section id="recipes" className="scroll-mt-8 py-16">
            <SectionTitle tag="Recipes" title="Complete integration examples" color="text-cyan-400" />
            <Tabs tabs={[
                { label: 'Customer support', lang: 'ts', title: 'Customer support flow (Meet)', code:
`// 1. Agent opens ticket — backend creates a room
const { room, joinToken: agentToken } = await meet.createRoom({
  name:             'Ticket #' + ticket.id + ' — ' + ticket.subject,
  waitingRoom:      true,    // agent admits customer manually
  recordingEnabled: true,
  webhookUrl:       'https://yourapp.com/webhooks/meet',
  webhookEvents:    ['room.ended', 'recording.ready'],
});

// 2. Issue a token for the customer
const { token: customerToken, joinUrl } = await meet.issueToken(room.uid, {
  displayName: customer.name,
  userId:      customer.id,
  role:        'participant',
});

// 3. Email the customer their join link
await email.send(customer.email, 'Your support call: ' + joinUrl + '?token=' + customerToken);

// 4. Webhook: room.ended → mark ticket resolved
case 'room.ended':
  await db.tickets.update(ticket.id, {
    resolved_at:   body.payload.ended_at,
    call_duration: body.payload.duration,
  });` },
                { label: 'Incident response', lang: 'ts', title: 'Incident response (Calls)', code:
`// Monitoring system detects an incident
async function onAlertFired(incident) {
  // Start urgent — escalate to emergency if no response
  const { call } = await calls.create({
    mode:         'one_to_one',
    calleeId:     incident.oncall_user_id,
    priority:     'urgent',
    priorityNote: '[' + incident.severity + '] ' + incident.title,
    muteOnJoin:   false,
    webhookUrl:   'https://yourapp.com/webhooks/calls',
  });

  // If no answer in 60s, escalate to emergency
  setTimeout(async () => {
    const { call: current } = await calls.get(call.uid);
    if (current.status === 'pending') {
      await calls.changePriority(
        call.uid,
        'emergency',
        'No response — escalating. Auto-answer in 5s.',
      );
    }
  }, 60_000);
}` },
                { label: 'On-demand meeting', lang: 'ts', title: 'Persistent meeting link', code:
`// Create a reusable room (e.g. weekly standup)
const { room } = await meet.createRoom({
  name:             'Weekly Standup',
  maxParticipants:  20,
  videoEnabled:     true,
  waitingRoom:      false,  // open join
  recordingEnabled: false,
});

// Issue per-user tokens on demand — room UID stays the same
app.get('/standup', async (req, res) => {
  const { token, joinUrl } = await meet.issueToken(room.uid, {
    displayName: req.user.name,
    userId:      req.user.id,
  });
  res.redirect(joinUrl + '?token=' + token);
});` },
            ]} />
        </section>
    );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ activeId }: { activeId: string }) {
    return (
        <aside className="sticky top-0 h-screen w-60 shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-900/40 py-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700">
            {/* Logo mark */}
            {/* <div className="mb-6 flex items-center gap-2.5 border-b border-zinc-800 px-5 pb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-sm">🛡</div>
                <div>
                    <p className="font-mono text-[13px] font-bold text-white">Defcomm</p>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">SDK Docs</p>
                </div>
            </div> */}

            <nav className="space-y-5 px-3">
                {NAV.map(group => (
                    <div key={group.label}>
                        <p className="mb-1.5 px-2 font-mono text-[9px] font-bold uppercase tracking-[2px] text-zinc-600">{group.label}</p>
                        <div className="space-y-0.5">
                            {group.items.map(item => (
                                <a key={item.id} href={`#${item.id}`}
                                    className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12px] transition
                                        ${activeId === item.id
                                            ? `${item.color.bg} ${item.color.text} font-semibold`
                                            : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}>
                                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${activeId === item.id ? item.color.dot : 'bg-zinc-700'}`} />
                                    {item.label}
                                </a>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocsSDK() {
    const [activeId, setActiveId] = useState('overview');

    // Track active section via IntersectionObserver
    useEffect(() => {
        const allIds = NAV.flatMap(g => g.items.map(i => i.id));
        const observers: IntersectionObserver[] = [];

        allIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const obs = new IntersectionObserver(
                ([entry]) => { if (entry.isIntersecting) setActiveId(id); },
                { rootMargin: '-20% 0px -70% 0px' }
            );
            obs.observe(el);
            observers.push(obs);
        });

        return () => observers.forEach(o => o.disconnect());
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="SDK Documentation" />

            <div className="flex min-h-screen">
                <Sidebar activeId={activeId} />

                {/* Main content */}
                <main className="flex-1 overflow-x-hidden">

                    {/* Hero */}
                    <div className="relative overflow-hidden border-b border-zinc-800 bg-zinc-900/20 px-12 py-14">
                        {/* Glow */}
                        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/5 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-12 left-32 h-48 w-48 rounded-full bg-violet-400/4 blur-3xl" />

                        <div className="relative max-w-2xl">
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                                <span className="font-mono text-[10px] font-bold uppercase tracking-[2px] text-cyan-400">v1.0 · REST + WebRTC</span>
                            </div>

                            <h1 className="mb-4 font-mono text-4xl font-bold leading-tight tracking-tight text-white">
                                Defcomm<br />
                                <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">SDK Reference</span>
                            </h1>

                            <p className="mb-8 text-base leading-relaxed text-zinc-400">
                                Add secure, encrypted video meetings and priority audio calls to any web application. Two SDKs. One API token. Zero media infrastructure to manage.
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {[
                                    { label: '📹 @defcomm/meet-sdk',  cls: 'border-emerald-400/25 bg-emerald-400/8 text-emerald-400' },
                                    { label: '📞 @defcomm/calls-sdk', cls: 'border-pink-400/25 bg-pink-400/8 text-pink-400' },
                                    { label: 'TypeScript · Node.js · Browser', cls: 'border-zinc-700 bg-zinc-800/60 text-zinc-400' },
                                ].map(b => (
                                    <span key={b.label} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-medium ${b.cls}`}>
                                        {b.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sections */}
                    <div className="max-w-[860px] px-12">
                        <SectionOverview />
                        <SectionInstallation />
                        <SectionAuth />
                        <SectionMeetQuick />
                        <SectionMeetApi />
                        <SectionMeetEmbed />
                        <SectionMeetEvents />
                        <SectionMeetWebhooks />
                        <SectionCallsQuick />
                        <SectionCallsPriority />
                        <SectionCallsApi />
                        <SectionCallsEmbed />
                        <SectionCallsEvents />
                        <SectionWebhooks />
                        <SectionChannels />
                        <SectionRecipes />
                    </div>

                </main>
            </div>
        </AppLayout>
    );
}
