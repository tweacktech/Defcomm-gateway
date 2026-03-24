// resources/js/pages/meet/guest.tsx
// Inertia view: 'meet/guest'
// Shown to unauthenticated visitors who follow a meeting link.
// Collects display_name, then verifies password if required.

import { Head, usePage, router } from '@inertiajs/react';
import {
    Video, User, Lock, Shield, RefreshCw, XCircle,
    Users, KeyRound, LogIn, Eye, EyeOff,
} from 'lucide-react';
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
    video_enabled: boolean;
    audio_enabled: boolean;
}

type PageProps = {
    room: RoomInfo;
    errors?: { display_name?: string; password?: string };
} & Record<string, unknown>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetGuest() {
    const { room, errors } = usePage<PageProps>().props;

    const [displayName, setDisplayName] = useState('');
    const [password, setPassword]       = useState('');
    const [showPw, setShowPw]           = useState(false);
    const [joining, setJoining]         = useState(false);

    const handleJoin = () => {
        if (!displayName.trim()) return;
        setJoining(true);
        router.post(`/meet/${room.uid}/guest`, {
            display_name: displayName.trim(),
            password: room.has_password ? password : undefined,
        }, {
            onError: () => setJoining(false),
            onFinish: () => setJoining(false),
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

                    {/* Room card */}
                    <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-800/60 p-4 text-center">
                        <h1 className="text-base font-bold text-white">{room.name}</h1>
                        <p className="mt-0.5 text-xs text-zinc-400">
                            Hosted by {room.owner_name}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-3 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {room.active_participants} in call
                            </span>
                            {room.has_password && (
                                <span className="flex items-center gap-1">
                                    <Lock className="h-3 w-3" />Password required
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Form */}
                    <div className="space-y-4">

                        {/* Display name */}
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium text-zinc-300">
                                Your name
                            </Label>
                            <div className="relative">
                                <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                <Input
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !room.has_password) handleJoin(); }}
                                    placeholder="e.g. Alice Johnson"
                                    autoFocus
                                    className="h-11 border-zinc-700 bg-zinc-800 pl-9 text-white placeholder:text-zinc-600 focus:border-primary"
                                />
                            </div>
                            {errors?.display_name && (
                                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                                    {errors.display_name}
                                </p>
                            )}
                        </div>

                        {/* Password (conditional) */}
                        {room.has_password && (
                            <div>
                                <Label className="mb-1.5 block text-xs font-medium text-zinc-300">
                                    Meeting password
                                </Label>
                                <div className="relative">
                                    <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                                    <Input
                                        type={showPw ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                                        placeholder="Enter password…"
                                        className="h-11 border-zinc-700 bg-zinc-800 pl-9 pr-9 text-white placeholder:text-zinc-600 focus:border-primary"
                                    />
                                    <button
                                        onClick={() => setShowPw(v => !v)}
                                        className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition">
                                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors?.password && (
                                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                                        {errors.password}
                                    </p>
                                )}
                            </div>
                        )}

                        <Button
                            onClick={handleJoin}
                            disabled={!displayName.trim() || (room.has_password && !password.trim()) || joining}
                            className="w-full gap-2 h-11 text-sm font-semibold">
                            {joining
                                ? <><RefreshCw className="h-4 w-4 animate-spin" />Joining…</>
                                : <><Video className="h-4 w-4" />Join Meeting</>}
                        </Button>
                    </div>

                    {/* Divider */}
                    <div className="my-5 flex items-center gap-3">
                        <div className="h-px flex-1 bg-zinc-800" />
                        <span className="text-xs text-zinc-600">or</span>
                        <div className="h-px flex-1 bg-zinc-800" />
                    </div>

                    {/* Sign in prompt */}
                    <a href={`/login?redirect=/meet/${room.uid}`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800">
                        <LogIn className="h-4 w-4" />
                        Sign in to Defcomm
                    </a>

                    {/* Security note */}
                    <div className="mt-5 flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-800/50 px-3 py-2.5">
                        <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        <p className="text-xs text-zinc-500">
                            You're joining as a guest. Your media is encrypted
                            end-to-end — it never passes through our servers.
                        </p>
                    </div>
                </div>

                <p className="mt-4 text-center text-xs text-zinc-600">
                    By joining, you agree to Defcomm's usage policy.
                </p>
            </div>
        </div>
    );
}
