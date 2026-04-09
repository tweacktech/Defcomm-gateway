// resources/js/pages/meet/ended.tsx
// Inertia view: 'meet/ended'
// Shown to anyone (auth or guest) when the room has already ended.

import { Head, usePage, router } from '@inertiajs/react';
import { PhoneOff, Video, Clock, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoomInfo {
    uid: string;
    name: string;
    owner_name: string;
    started_at: string | null;
    ended_at?: string | null;
}

type PageProps = {
    room: RoomInfo;
    auth?: { user: { id: number } };
} & Record<string, unknown>;

const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

export default function MeetEnded() {
    const { room, auth } = usePage<PageProps>().props;
    const isAuth = !!auth?.user;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4">
            <Head title={`${room.name} — Meeting Ended`} />

            {/* Brand */}
            <div className="mb-8 flex items-center gap-2.5">
                <div className="rounded-xl bg-primary/10 p-2.5">
                    <Video className="h-6 w-6 text-primary" />
                </div>
                <span className="text-lg font-bold text-white">Defcomm Meet</span>
            </div>

            <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl">
                {/* Icon */}
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                    <PhoneOff className="h-7 w-7 text-red-400" />
                </div>

                <h1 className="mb-1 text-xl font-bold text-white">Meeting Ended</h1>
                <p className="mb-1 text-sm text-zinc-400">{room.name}</p>
                <p className="text-xs text-zinc-600">Hosted by {room.owner_name}</p>

                {room.started_at && (
                    <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                        <Clock className="h-3.5 w-3.5" />
                        Started {fmtDateTime(room.started_at)}
                    </div>
                )}

                <div className="mt-8 space-y-2">
                    {isAuth ? (
                        <Button onClick={() => router.get('/meet')} className="w-full gap-2">
                            <Home className="h-4 w-4" />Back to Meet
                        </Button>
                    ) : (
                        // <a href="/"
                        //     className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition">
                        //     <Home className="h-4 w-4" />Go to Homepage
                        // </a>

                         <Button onClick={() => router.get('/meets')} variant="outline"
                                        className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                                        <Video className="h-4 w-4" />Back to Calls
                                    </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
