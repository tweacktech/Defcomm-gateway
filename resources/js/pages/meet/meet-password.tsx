// resources/js/pages/meet/password.tsx
// Inertia view: 'meet/password'
// Shown when a room is password-protected — both auth and guest users land here.

import { Head, usePage, router } from '@inertiajs/react';
import { KeyRound, Video, Users, Lock, Shield, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoomInfo {
    uid: string;
    name: string;
    owner_name: string;
    active_participants: number;
    has_password: boolean;
}

type PageProps = {
    room: RoomInfo;
    guest_name?: string;        // pre-filled if coming from guest page
    errors?: { password?: string };
} & Record<string, unknown>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetPassword() {
    const { room, guest_name, errors } = usePage<PageProps>().props;

    const [password, setPassword] = useState('');
    const [unlocking, setUnlocking] = useState(false);

    const handleUnlock = () => {
        if (!password.trim()) return;
        setUnlocking(true);
        router.post(`/meet/${room.uid}/password`, {
            password,
            guest_name: guest_name ?? undefined,
        }, {
            onError: () => setUnlocking(false),
            onFinish: () => setUnlocking(false),
        });
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4">
            <Head title={`Join ${room.name} — Defcomm Meet`} />

            {/* Brand */}
            <div className="mb-8 flex items-center gap-2.5">
                <div className="rounded-xl bg-primary/10 p-2.5">
                    <Video className="h-6 w-6 text-primary" />
                </div>
                <span className="text-lg font-bold text-white">Defcomm Meet</span>
            </div>

            <div className="w-full max-w-sm">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">

                    {/* Room info */}
                    <div className="mb-6 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Lock className="h-7 w-7 text-primary" />
                        </div>
                        <h1 className="text-xl font-bold text-white">{room.name}</h1>
                        <p className="mt-1 text-sm text-zinc-400">
                            Hosted by {room.owner_name}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                            <Users className="h-3 w-3" />
                            {room.active_participants} already in the call
                        </div>
                    </div>

                    {/* Password field */}
                    <div className="space-y-4">
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium text-zinc-300">
                                Meeting password
                            </Label>
                            <div className="relative">
                                <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
                                    placeholder="Enter password…"
                                    autoFocus
                                    className="h-11 border-zinc-700 bg-zinc-800 pl-9 text-white placeholder:text-zinc-600 focus:border-primary"
                                />
                            </div>
                            {errors?.password && (
                                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <Button
                            onClick={handleUnlock}
                            disabled={!password.trim() || unlocking}
                            className="w-full gap-2 h-11">
                            {unlocking
                                ? <><RefreshCw className="h-4 w-4 animate-spin" />Verifying…</>
                                : <><KeyRound className="h-4 w-4" />Join Meeting</>}
                        </Button>
                    </div>

                    {/* Info */}
                    <div className="mt-5 flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-800/50 px-3 py-2.5">
                        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        <p className="text-xs text-zinc-500">
                            This meeting is end-to-end encrypted via WebRTC.
                            Your media never passes through our servers.
                        </p>
                    </div>
                </div>

                <p className="mt-4 text-center text-xs text-zinc-600">
                    Don't have the password? Contact the meeting host.
                </p>
            </div>
        </div>
    );
}
