// resources/js/pages/meet/index.tsx
// Meet lobby — create a room or join an existing one

import { Head, usePage, router } from '@inertiajs/react';
import {
    Video, Plus, Clock, Users, Link2, Copy, Check,
    Calendar, Lock, PhoneCall, Globe, Mic,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface RoomSummary {
    uid: string;
    name: string;
    status: string;
    active_participants: number;
    has_password: boolean;
    started_at: string | null;
    scheduled_at: string | null;
    join_url: string;
}

type PageProps = {
    rooms: RoomSummary[];
    auth: { user: { id: number; name: string } };
} & Record<string, unknown>;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Meet', href: '/meet' },
];

const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
});

function RoomCard({ room }: { room: RoomSummary }) {
    const [copied, setCopied] = useState(false);

    const copy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(room.join_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const statusColor = room.status === 'active'
        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
        : room.status === 'scheduled'
        ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
        : 'bg-muted/60 text-muted-foreground';

    return (
        <div className="flex cursor-pointer items-start gap-4 rounded-xl border border-sidebar-border/70 bg-card p-5 transition hover:bg-muted/30"
            onClick={() => router.get(`/meet/${room.uid}`)}>
            <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                <Video className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <p className="truncate font-semibold">{room.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
                        {room.status}
                    </span>
                    {room.has_password && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {room.active_participants} active
                    </span>
                    {room.started_at && (
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Started {fmtTime(room.started_at)}
                        </span>
                    )}
                    {room.scheduled_at && !room.started_at && (
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {fmtTime(room.scheduled_at)}
                        </span>
                    )}
                    <code className="text-[10px] text-muted-foreground/60">{room.uid}</code>
                </div>
            </div>
            <button onClick={copy}
                className="shrink-0 rounded-lg border border-sidebar-border/50 p-2 hover:bg-accent transition"
                title="Copy invite link">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
        </div>
    );
}

function CreateRoomModal({ onClose }: { onClose: () => void }) {
    const [name, setName]                 = useState('');
    const [password, setPassword]         = useState('');
    const [maxParticipants, setMax]       = useState('50');
    const [videoEnabled, setVideo]        = useState(true);
    const [screenShare, setScreenShare]   = useState(true);
    const [waitingRoom, setWaiting]       = useState(false);
    const [creating, setCreating]         = useState(false);

    const submit = () => {
        setCreating(true);
        router.post('/meet/rooms', {
            name:                 name || undefined,
            password:             password || undefined,
            max_participants:     parseInt(maxParticipants) || 50,
            video_enabled:        videoEnabled,
            audio_enabled:        true,
            screen_share_enabled: screenShare,
            waiting_room:         waitingRoom,
        }, {
            onFinish: () => setCreating(false),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-sidebar-border/70 bg-card p-6 shadow-xl">
                <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5">
                        <Video className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold">New Meeting</h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <Label className="mb-1.5 block text-xs font-medium">Meeting name (optional)</Label>
                        <Input value={name} onChange={e => setName(e.target.value)}
                            placeholder="e.g. Weekly Standup" className="h-9" />
                    </div>

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
                            <Input type="number" value={maxParticipants} onChange={e => setMax(e.target.value)}
                                min="2" max="200" className="h-9 text-sm" />
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Video', icon: Video, value: videoEnabled, set: setVideo },
                            { label: 'Screen share', icon: Globe, value: screenShare, set: setScreenShare },
                            { label: 'Waiting room', icon: Clock, value: waitingRoom, set: setWaiting },
                        ].map(({ label, icon: Icon, value, set }) => (
                            <button key={label} onClick={() => set((v: boolean) => !v)}
                                className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-xs transition
                                    ${value ? 'border-primary bg-primary/10 text-primary' : 'border-sidebar-border/50 text-muted-foreground hover:bg-accent/30'}`}>
                                <Icon className="h-4 w-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <Button onClick={submit} disabled={creating} className="flex-1 gap-2">
                        {creating ? 'Starting…' : <><PhoneCall className="h-4 w-4" />Start Meeting</>}
                    </Button>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </div>
    );
}

export default function MeetIndex() {
    const { rooms, auth } = usePage<PageProps>().props;
    const [joinUid, setJoinUid]   = useState('');
    const [creating, setCreating] = useState(false);

    const active    = rooms.filter(r => r.status === 'active');
    const scheduled = rooms.filter(r => r.status === 'scheduled');
    const past      = rooms.filter(r => r.status === 'ended').slice(0, 5);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Meet" />
            {creating && <CreateRoomModal onClose={() => setCreating(false)} />}

            <div className="mx-auto max-w-4xl p-6">
                {/* Hero */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Defcomm Meet</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Secure video and audio calls, straight from your workspace.
                        </p>
                    </div>
                    <Button onClick={() => setCreating(true)} className="gap-2">
                        <Plus className="h-4 w-4" />New Meeting
                    </Button>
                </div>

                {/* Quick join */}
                <div className="mb-8 flex gap-3 rounded-xl border border-sidebar-border/70 bg-card p-5">
                    <div className="relative flex-1">
                        <Link2 className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={joinUid}
                            onChange={e => setJoinUid(e.target.value.trim())}
                            onKeyDown={e => { if (e.key === 'Enter' && joinUid) router.get(`/meet/${joinUid}`); }}
                            placeholder="Paste a meeting ID or link to join…"
                            className="h-11 pl-9 text-sm"
                        />
                    </div>
                    <Button disabled={!joinUid} onClick={() => router.get(`/meet/${joinUid}`)} className="gap-2 px-6">
                        <PhoneCall className="h-4 w-4" />Join
                    </Button>
                </div>

                {/* Active */}
                {active.length > 0 && (
                    <div className="mb-6">
                        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                            Active ({active.length})
                        </p>
                        <div className="space-y-2">
                            {active.map(r => <RoomCard key={r.uid} room={r} />)}
                        </div>
                    </div>
                )}

                {/* Scheduled */}
                {scheduled.length > 0 && (
                    <div className="mb-6">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Scheduled ({scheduled.length})
                        </p>
                        <div className="space-y-2">
                            {scheduled.map(r => <RoomCard key={r.uid} room={r} />)}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {rooms.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-sidebar-border/50 py-16 text-center">
                        <Video className="h-12 w-12 text-muted-foreground/30" />
                        <div>
                            <p className="font-semibold">No meetings yet</p>
                            <p className="text-sm text-muted-foreground">
                                Start a new meeting or join one with a code.
                            </p>
                        </div>
                        <Button onClick={() => setCreating(true)} className="gap-2">
                            <Plus className="h-4 w-4" />Start your first meeting
                        </Button>
                    </div>
                )}

                {/* Past */}
                {past.length > 0 && (
                    <div className="mt-8">
                        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Recent ({past.length})
                        </p>
                        <div className="space-y-2 opacity-60">
                            {past.map(r => <RoomCard key={r.uid} room={r} />)}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
