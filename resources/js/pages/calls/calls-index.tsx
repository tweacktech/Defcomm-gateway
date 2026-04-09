// resources/js/pages/calls/index.tsx

import { Head, usePage, router } from '@inertiajs/react';
import axios from 'axios';
import {
    Phone, PhoneCall, PhoneOff, Clock, Users, Shield,
    AlertTriangle, AlertCircle, Siren, Plus, ChevronRight,
    User, Mic, MicOff, X,
    Video,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CallSummary {
    uid: string; title: string; mode: string; status: string;
    priority: string; priority_label: string; priority_color: string; priority_note: string | null;
    initiator_name: string; callee_name: string | null;
    active_participants: number; started_at: string | null; ended_at: string | null;
    duration_seconds: number | null; join_url: string;
}

type Priority = 'routine' | 'important' | 'urgent' | 'emergency';
type PageProps = { calls: CallSummary[]; auth: { user: { id: number; name: string } } } & Record<string, unknown>;

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Calls', href: '/calls' }];

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITIES: { value: Priority; label: string; icon: any; desc: string; ring: string; badge: string }[] = [
    { value: 'routine',   label: 'Routine',   icon: Phone,         desc: 'Normal call, can be declined',
      ring: 'border-zinc-600', badge: 'bg-zinc-700/60 text-zinc-300' },
    { value: 'important', label: 'Important', icon: AlertCircle,   desc: 'Flagged — logged and tracked',
      ring: 'border-blue-500',  badge: 'bg-blue-600/20 text-blue-400' },
    { value: 'urgent',    label: 'Urgent',    icon: AlertTriangle, desc: 'Overrides DND, auto-answers in 30s',
      ring: 'border-orange-500', badge: 'bg-orange-600/20 text-orange-400' },
    { value: 'emergency', label: 'Emergency', icon: Siren,         desc: 'Cannot be declined. Bypasses all restrictions.',
      ring: 'border-red-500',   badge: 'bg-red-600/20 text-red-400' },
];

const getPriority = (v: string) => PRIORITIES.find(p => p.value === v) ?? PRIORITIES[0];

function PriorityBadge({ priority }: { priority: string }) {
    const p = getPriority(priority);
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${p.badge}`}>
            <p.icon className="h-2.5 w-2.5" />{p.label}
        </span>
    );
}

function fmtDuration(s: number | null) {
    if (!s) return '—';
    const m = Math.floor(s / 60); const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ─── Call card ────────────────────────────────────────────────────────────────

function CallCard({ call }: { call: CallSummary }) {
    const p = getPriority(call.priority);
    const isActive = ['pending', 'active', 'on_hold'].includes(call.status);

    return (
        <div
            onClick={() => router.get(call.join_url)}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-4 transition hover:bg-muted/20
                ${isActive ? `${p.ring} border-opacity-60` : 'border-sidebar-border/60'}`}>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full
                ${isActive ? 'bg-green-500/10' : 'bg-muted/40'}`}>
                {isActive
                    ? <PhoneCall className="h-5 w-5 text-green-500" />
                    : <PhoneOff className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="truncate text-sm font-semibold">{call.title}</span>
                    <PriorityBadge priority={call.priority} />
                    {call.status === 'on_hold' && (
                        <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400">Hold</span>
                    )}
                </div>
                {call.priority_note && (
                    <p className="mb-1 text-xs text-muted-foreground italic truncate">{call.priority_note}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {call.mode === 'group' && (
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{call.active_participants} active</span>
                    )}
                    {call.duration_seconds !== null && (
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDuration(call.duration_seconds)}</span>
                    )}
                    <span className="capitalize">{call.status}</span>
                </div>
            </div>
            {isActive && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </div>
    );
}

// ─── New Call Modal ───────────────────────────────────────────────────────────

function NewCallModal({ onClose }: { onClose: () => void }) {
    const [mode,        setMode]        = useState<'one_to_one' | 'group'>('one_to_one');
    const [calleeId,    setCalleeId]    = useState('');
    const [title,       setTitle]       = useState('');
    const [priority,    setPriority]    = useState<Priority>('routine');
    const [note,        setNote]        = useState('');
    const [muteOnJoin,  setMuteOnJoin]  = useState(true);
    const [waitingRoom, setWaitingRoom] = useState(false);
    const [creating,    setCreating]    = useState(false);
    const [error,       setError]       = useState('');

    const priorCfg = getPriority(priority);

    const submit = async () => {
        if (mode === 'one_to_one' && !calleeId.trim()) {
            setError('Enter a user ID to call.'); return;
        }
        setCreating(true); setError('');
        try {
            const { data } = await axios.post('/calls', {
                mode, title: title || undefined,
                callee_id: mode === 'one_to_one' ? parseInt(calleeId) : undefined,
                priority, priority_note: note || undefined,
                mute_on_join: muteOnJoin, waiting_room: waitingRoom,
            });
            router.get(data.data.join_url);
        } catch (e: any) {
            setError(e.response?.data?.message ?? 'Failed to start call.');
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-sidebar-border/70 bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-sidebar-border/50 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-green-500/10 p-2"><Phone className="h-5 w-5 text-green-500" /></div>
                        <h2 className="text-lg font-bold">New Call</h2>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent transition"><X className="h-4 w-4 text-muted-foreground" /></button>
                </div>

                <div className="space-y-5 p-6">
                    {/* Mode */}
                    <div>
                        <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Call Type</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {([['one_to_one', 'Direct Call', User], ['group', 'Group Call', Users]] as const).map(([v, l, Icon]) => (
                                <button key={v} onClick={() => setMode(v as any)}
                                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition
                                        ${mode === v ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-sidebar-border/50 text-muted-foreground hover:bg-accent/30'}`}>
                                    <Icon className="h-4 w-4" />{l}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Callee */}
                    {mode === 'one_to_one' && (
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium">User ID to call</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input value={calleeId} onChange={e => setCalleeId(e.target.value)}
                                    placeholder="Enter user ID…" className="h-9 pl-9 text-sm" />
                            </div>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <Label className="mb-1.5 block text-xs font-medium">Title (optional)</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Security Incident Briefing" className="h-9" />
                    </div>

                    {/* Priority */}
                    <div>
                        <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {PRIORITIES.map(p => (
                                <button key={p.value} onClick={() => setPriority(p.value)}
                                    className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition
                                        ${priority === p.value ? `${p.ring} ${p.badge} border-opacity-100 font-semibold` : 'border-sidebar-border/50 text-muted-foreground hover:bg-accent/30'}`}>
                                    <p.icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <div><p className="font-medium">{p.label}</p><p className="opacity-70">{p.desc}</p></div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Priority note */}
                    {priority !== 'routine' && (
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium">Priority note <span className="text-muted-foreground">(shown to callee)</span></Label>
                            <Input value={note} onChange={e => setNote(e.target.value)}
                                placeholder={priority === 'emergency' ? 'e.g. System breach — respond immediately' : 'Brief context…'}
                                className="h-9" />
                        </div>
                    )}

                    {/* Options */}
                    <div className="flex gap-3">
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-sidebar-border/50 px-3 py-2.5 text-xs hover:bg-accent/20 transition">
                            <input type="checkbox" checked={muteOnJoin} onChange={e => setMuteOnJoin(e.target.checked)} className="accent-primary" />
                            <Mic className="h-3.5 w-3.5" />Mute on join
                        </label>
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-sidebar-border/50 px-3 py-2.5 text-xs hover:bg-accent/20 transition">
                            <input type="checkbox" checked={waitingRoom} onChange={e => setWaitingRoom(e.target.checked)} className="accent-primary" />
                            <Shield className="h-3.5 w-3.5" />Waiting room
                        </label>
                    </div>

                    {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
                </div>

                <div className="flex gap-3 border-t border-sidebar-border/50 px-6 py-4">
                    <Button onClick={submit} disabled={creating} className="flex-1 gap-2 h-10">
                        {creating ? 'Starting…' : <><PhoneCall className="h-4 w-4" />Start Call</>}
                    </Button>
                    <Button variant="outline" onClick={onClose} className="h-10">Cancel</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CallsIndex() {
    const { calls } = usePage<PageProps>().props;
    const [showNew, setShowNew] = useState(false);

    const active = calls.filter(c => ['pending', 'active', 'on_hold'].includes(c.status));
    const past   = calls.filter(c => ['ended', 'missed', 'declined'].includes(c.status));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Calls" />
             <Button onClick={() => router.get('/meet')} variant="outline"
                 className="gap-4 border-zinc-700 text-black-300 hover:bg-blue-200 max-w-3xl min-w-2x">
                <Video className="h-4 w-4" />Go to Meetings
            </Button>
            {showNew && <NewCallModal onClose={() => setShowNew(false)} />}

            <div className="mx-auto max-w-2xl p-6">
                
                <div className="mb-6 flex items-center justify-between">

                    <div>
                        <h1 className="text-2xl font-bold">Calls</h1>
                        <p className="mt-0.5 text-sm text-muted-foreground">Secure audio calls with priority levels.</p>
                    </div>
                    <Button onClick={() => setShowNew(true)} className="gap-2">
                        <Plus className="h-4 w-4" />New Call
                    </Button>
                </div>

                {active.length > 0 && (
                    <div className="mb-6">
                        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />Active ({active.length})
                        </p>
                        <div className="space-y-2">{active.map(c => <CallCard key={c.uid} call={c} />)}</div>
                    </div>
                )}

                {past.length > 0 && (
                    <div>
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
                        <div className="space-y-2 opacity-70">{past.map(c => <CallCard key={c.uid} call={c} />)}</div>
                    </div>
                )}

                {calls.length === 0 && (
                    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-sidebar-border/50 py-16 text-center">
                        <Phone className="h-12 w-12 text-muted-foreground/30" />
                        <div><p className="font-semibold">No calls yet</p><p className="text-sm text-muted-foreground">Start a direct or group call.</p></div>
                        <Button onClick={() => setShowNew(true)} className="gap-2"><Plus className="h-4 w-4" />New Call</Button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
