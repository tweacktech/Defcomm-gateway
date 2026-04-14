// resources/js/pages/meet/index.tsx

import { Head, usePage, router } from '@inertiajs/react';
import {
    Video, Plus, Clock, Users, Copy, Check, Calendar,
    Lock, PhoneCall, Link2, ScreenShare, Settings2, X,
    Phone,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface RoomSummary {
    uid: string; name: string; status: string;
    active_participants: number; has_password: boolean;
    started_at: string | null; scheduled_at: string | null; join_url: string;
}
type Paginator<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

type RecordingSummary = {
    id: number;
    room_uid: string | null;
    room_name: string | null;
    status: string;
    size: number;
    duration_seconds: number | null;
    started_at: string | null;
    ended_at: string | null;
    download_url: string | null;
};

type PageProps = {
    rooms: Paginator<RoomSummary>;
    room_counts: { all: number; active: number; scheduled: number; ended: number };
    recordings: Paginator<RecordingSummary>;
} & Record<string, unknown>;

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Meet', href: '/meet' }];
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function RoomCard({ room }: { room: RoomSummary }) {
    const [copied, setCopied] = useState(false);
    const statusColor = room.status === 'active'
        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
        : room.status === 'scheduled'
        ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
        : 'bg-muted/60 text-muted-foreground';

    return (
        <div className="flex cursor-pointer items-start gap-4 rounded-xl border border-sidebar-border/70 bg-card p-4 transition hover:bg-muted/30"
            onClick={() => router.get(`/meet/${room.uid}`)}>
            <div className={`rounded-xl p-2.5 shrink-0 ${room.status === 'active' ? 'bg-green-500/10' : 'bg-primary/10'}`}>
                <Video className={`h-5 w-5 ${room.status === 'active' ? 'text-green-500' : 'text-primary'}`} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                    <p className="truncate font-semibold text-sm">{room.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusColor}`}>{room.status}</span>
                    {room.has_password && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{room.active_participants} active</span>
                    {room.started_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Started {fmtTime(room.started_at)}</span>}
                    {room.scheduled_at && !room.started_at && (
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(room.scheduled_at)} at {fmtTime(room.scheduled_at)}</span>
                    )}
                </div>
            </div>
            <button onClick={e => {
                e.stopPropagation();
                navigator.clipboard.writeText(room.join_url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }} className="shrink-0 rounded-lg border border-sidebar-border/50 p-1.5 hover:bg-accent transition">
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
        </div>
    );
}

function Toggle({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs transition
                ${active ? 'border-primary bg-primary/10 text-primary' : 'border-sidebar-border/50 text-muted-foreground hover:bg-accent/30'}`}>
            <Icon className="h-4 w-4" />{label}
        </button>
    );
}

function CreateModal({ onClose }: { onClose: () => void }) {
    const [mode, setMode]           = useState<'now' | 'later'>('now');
    const [name, setName]           = useState('');
    const [password, setPassword]   = useState('');
    const [maxP, setMaxP]           = useState('20');
    const [schedDate, setSchedDate] = useState('');
    const [schedTime, setSchedTime] = useState('');
    const [video, setVideo]         = useState(false);
    const [screen, setScreen]       = useState(true);
    const [waiting, setWaiting]     = useState(true);
    const [recording, setRecording] = useState(false);
    const [creating, setCreating]   = useState(false);

    const canSubmit = mode === 'now' || (!!schedDate && !!schedTime);

    const submit = () => {
        setCreating(true);
        const scheduledAt = mode === 'later' && schedDate && schedTime
            ? `${schedDate}T${schedTime}:00` : undefined;

        router.post('/meet/rooms', {
            name:                 name.trim() || undefined,
            password:             password || undefined,
            max_participants:     parseInt(maxP) || 50,
            video_enabled:        video,
            audio_enabled:        true,
            screen_share_enabled: screen,
            recording_enabled:    recording,
            waiting_room:         waiting,
            scheduled_at:         scheduledAt,
        }, { onFinish: () => setCreating(false) });
    };

    // Minimum date for date picker = today
    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-sidebar-border/70 bg-card shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-sidebar-border/50 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-primary/10 p-2">
                            <Video className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="text-lg font-bold">New Meeting</h2>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent transition">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                <div className="space-y-5 p-6">
                    {/* When to start */}
                    <div>
                        <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            When
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { key: 'now'   as const, label: 'Start immediately', icon: PhoneCall },
                                { key: 'later' as const, label: 'Schedule for later', icon: Calendar  },
                            ]).map(opt => (
                                <button key={opt.key} onClick={() => setMode(opt.key)}
                                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition
                                        ${mode === opt.key ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-sidebar-border/50 text-muted-foreground hover:bg-accent/30'}`}>
                                    <opt.icon className="h-4 w-4" />{opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date + Time picker (scheduled mode only) */}
                    {mode === 'later' && (
                        <div className="grid grid-cols-2 gap-3 rounded-xl border border-sidebar-border/50 bg-muted/20 p-4">
                            <div>
                                <Label className="mb-1.5 block text-xs font-medium">Date</Label>
                                <Input type="date" value={schedDate} min={today}
                                    onChange={e => setSchedDate(e.target.value)} className="h-9 text-sm" />
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-xs font-medium">Time</Label>
                                <Input type="time" value={schedTime}
                                    onChange={e => setSchedTime(e.target.value)} className="h-9 text-sm" />
                            </div>
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <Label className="mb-1.5 block text-xs font-medium">Meeting name (optional)</Label>
                        <Input value={name} onChange={e => setName(e.target.value)}
                            placeholder="e.g. Team Standup, Client Call…" className="h-9" />
                    </div>

                    {/* Password + Max */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium">
                                <Lock className="mr-1 inline h-3 w-3" />Password
                            </Label>
                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                                placeholder="Optional" className="h-9 text-sm" />
                        </div>
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium">
                                <Users className="mr-1 inline h-3 w-3" />Max participants
                            </Label>
                            <Input type="number" value={maxP} onChange={e => setMaxP(e.target.value)}
                                min="2" max="200" className="h-9 text-sm" />
                        </div>
                    </div>

                    {/* Feature toggles */}
                    <div>
                        <Label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Options
                        </Label>
                        <div className="grid grid-cols-4 gap-2">
                            <Toggle icon={Video}       label="Video"        active={video}     onClick={() => setVideo(v => !v)} />
                            <Toggle icon={ScreenShare} label="Screen share" active={screen}    onClick={() => setScreen(s => !s)} />
                            <Toggle icon={Clock}       label="Waiting room" active={waiting}   onClick={() => setWaiting(w => !w)} />
                            <Toggle icon={Settings2}   label="Recording"    active={recording} onClick={() => setRecording(r => !r)} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 border-t border-sidebar-border/50 px-6 py-4">
                    <Button onClick={submit} disabled={!canSubmit || creating} className="flex-1 gap-2 h-10">
                        {creating ? 'Creating…'
                            : mode === 'now'
                                ? <><PhoneCall className="h-4 w-4" />Start Meeting</>
                                : <><Calendar className="h-4 w-4" />Schedule Meeting</>}
                    </Button>
                    <Button variant="outline" onClick={onClose} className="h-10">Cancel</Button>
                </div>
            </div>
        </div>
    );
}

export default function MeetIndex() {
    const { rooms, room_counts, recordings } = usePage<PageProps>().props;
    const [joinUid, setJoinUid]     = useState('');
    const [showCreate, setCreate]   = useState(false);

    const active    = rooms.data.filter(r => r.status === 'active');
    const scheduled = rooms.data.filter(r => r.status === 'scheduled');
    const past      = rooms.data.filter(r => r.status === 'ended').slice(0, 5);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Meet" />
             <Button onClick={() => router.get('/calls')} variant="outline"
                className="gap-4 border-zinc-700 text-black-300 hover:bg-green-700 max-w-3xl min-w-1x btn-md">
                <Phone className="h-4 w-4" />Go to Calls
            </Button>
            {showCreate && <CreateModal onClose={() => setCreate(false)} />}

            <div className="mx-auto max-w-3xl p-6">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Defcomm Meet</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Secure, encrypted video and audio calls.</p>
                    </div>
                    <Button onClick={() => setCreate(true)} className="gap-2">
                        <Plus className="h-4 w-4" />New Meeting
                    </Button>
                </div>

                {/* Join box */}
                <div className="mb-8 flex gap-3 rounded-xl border border-sidebar-border/70 bg-card p-5">
                    <div className="relative flex-1">
                        <Link2 className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={joinUid} onChange={e => setJoinUid(e.target.value.trim())}
                            onKeyDown={e => { if (e.key === 'Enter' && joinUid) router.get(`/meet/${joinUid}`); }}
                            placeholder="Paste a meeting ID or link…" className="h-11 pl-9 text-sm" />
                    </div>
                    <Button disabled={!joinUid} onClick={() => router.get(`/meet/${joinUid}`)} className="gap-2 px-5">
                        <PhoneCall className="h-4 w-4" />Join
                    </Button>
                </div>

                {active.length > 0 && (
                    <div className="mb-6">
                        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                            Live now ({active.length})
                        </p>
                        <div className="space-y-2">{active.map(r => <RoomCard key={r.uid} room={r} />)}</div>
                    </div>
                )}

                {scheduled.length > 0 && (
                    <div className="mb-6">
                        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />Scheduled ({scheduled.length})
                        </p>
                        <div className="space-y-2">{scheduled.map(r => <RoomCard key={r.uid} room={r} />)}</div>
                    </div>
                )}

                <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                        {room_counts.all} total • {room_counts.active} active • {room_counts.scheduled} scheduled • {room_counts.ended} ended
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            disabled={rooms.current_page <= 1}
                            onClick={() => router.get('/meet', { page: rooms.current_page - 1, recordings_page: recordings.current_page })}
                        >
                            Prev
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            Page {rooms.current_page} / {rooms.last_page}
                        </span>
                        <Button
                            variant="outline"
                            disabled={rooms.current_page >= rooms.last_page}
                            onClick={() => router.get('/meet', { page: rooms.current_page + 1, recordings_page: recordings.current_page })}
                        >
                            Next
                        </Button>
                    </div>
                </div>

                {rooms.data.length === 0 && (
                    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-sidebar-border/50 py-16 text-center">
                        <Video className="h-12 w-12 text-muted-foreground/30" />
                        <div>
                            <p className="font-semibold">No meetings yet</p>
                            <p className="text-sm text-muted-foreground">Start one now or schedule for later.</p>
                        </div>
                        <Button onClick={() => setCreate(true)} className="gap-2">
                            <Plus className="h-4 w-4" />New Meeting
                        </Button>
                    </div>
                )}

                {past.length > 0 && (
                    <div className="mt-8">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
                        <div className="space-y-2 opacity-60">{past.map(r => <RoomCard key={r.uid} room={r} />)}</div>
                    </div>
                )}

                <div className="mt-10">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recordings</p>
                            <p className="text-xs text-muted-foreground">{recordings.total} total</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                disabled={recordings.current_page <= 1}
                                onClick={() => router.get('/meet', { page: rooms.current_page, recordings_page: recordings.current_page - 1 })}
                            >
                                Prev
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                Page {recordings.current_page} / {recordings.last_page}
                            </span>
                            <Button
                                variant="outline"
                                disabled={recordings.current_page >= recordings.last_page}
                                onClick={() => router.get('/meet', { page: rooms.current_page, recordings_page: recordings.current_page + 1 })}
                            >
                                Next
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {recordings.data.length === 0 && (
                            <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 text-sm text-muted-foreground">
                                No recordings yet.
                            </div>
                        )}
                        {recordings.data.map(r => (
                            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sidebar-border/70 bg-card p-4">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">
                                        {r.room_name ?? r.room_uid ?? 'Meeting'} • Recording #{r.id}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Status: {r.status}</p>
                                </div>
                                {r.download_url ? (
                                    <a
                                        href={r.download_url}
                                        className="shrink-0 rounded-lg border border-sidebar-border/50 px-3 py-2 text-xs hover:bg-accent transition"
                                    >
                                        Download
                                    </a>
                                ) : (
                                    <span className="shrink-0 text-xs text-muted-foreground">Not ready</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
