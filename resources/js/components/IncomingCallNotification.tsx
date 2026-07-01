
// ═══════════════════════════════════════════════════════════════════════════════
// resources/js/components/IncomingCallNotification.tsx
//
// Mount this in your root layout. It listens on the personal user channel
// for incoming call events and shows a ringing notification.
//
// Usage in your AppLayout or authenticated layout:
//   import IncomingCallNotification from '@/components/IncomingCallNotification';
//   <IncomingCallNotification userId={auth.user.id} reverbKey={...} reverbHost={...} reverbPort={...} />
// ═══════════════════════════════════════════════════════════════════════════════

// (In a real project this would be a separate file — included here for convenience)


import axios from 'axios';
import { Phone, PhoneOff, AlertTriangle, AlertCircle, Siren, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { router } from '@inertiajs/react';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

const PRIORITY_RING: Record<string, { bg: string; border: string; icon: any; pulse: boolean }> = {
    routine:   { bg: 'bg-zinc-900',      border: 'border-zinc-700',   icon: Phone,         pulse: false },
    important: { bg: 'bg-blue-950',      border: 'border-blue-600',   icon: AlertCircle,   pulse: false },
    urgent:    { bg: 'bg-orange-950',    border: 'border-orange-500', icon: AlertTriangle, pulse: true  },
    emergency: { bg: 'bg-red-950',       border: 'border-red-500',    icon: Siren,         pulse: true  },
};

console.log('incoming call')

interface IncomingCall {
    uid: string; title: string; initiator: string; priority: string;
    priority_note: string | null; mode: string;
}

export default function IncomingCallNotification({ userId, reverbKey, reverbHost, reverbPort }: {
    userId: number; reverbKey: string; reverbHost: string; reverbPort: number;
}) {
    const [incoming, setIncoming] = useState<IncomingCall | null>(null);
    const echoRef = useRef<any>(null);
    const ringerRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        (window as any).Pusher = Pusher;
        const echo = new Echo({
            broadcaster: 'reverb', key: reverbKey,
            wsHost: reverbHost, wsPort: reverbPort,
            forceTLS: false, enabledTransports: ['ws', 'wss'],
        });
        echoRef.current = echo;

        echo.private(`user.${userId}`)
            .listen('.call.initiated', (data: IncomingCall) => {
                setIncoming(data);
                // Play ring tone
                ringerRef.current = new Audio('/sounds/ring.mp3');
                ringerRef.current.loop = true;
                ringerRef.current.play().catch(() => {});

                // Emergency: auto-answer after 5s
                if (data.priority === 'emergency') {
                    setTimeout(() => { answer(data.uid); }, 5000);
                }
                // Urgent: auto-answer after 30s
                if (data.priority === 'urgent') {
                    setTimeout(() => { if (incoming?.uid === data.uid) answer(data.uid); }, 30000);
                }
            });

        echo.private(`user.${userId}`)
            .listen('.call.ended', () => { stopRing(); setIncoming(null); })
            .listen('.call.declined', () => { stopRing(); setIncoming(null); });

        return () => { echo.leave(`user.${userId}`); stopRing(); };
    }, [userId]);

    const stopRing = () => { ringerRef.current?.pause(); ringerRef.current = null; };

    const answer = (uid: string) => {
        stopRing();
        setIncoming(null);
        router.get(`/calls/${uid}`);
    };

    const decline = async (uid: string) => {
        stopRing();
        setIncoming(null);
        await axios.post(`/calls/${uid}/decline`).catch(() => {});
    };

    if (!incoming) return null;

    const cfg = PRIORITY_RING[incoming.priority] ?? PRIORITY_RING.routine;
    const Icon = cfg.icon;

    return (
        <div className={`fixed bottom-6 right-6 z-[9999] w-80 rounded-2xl border shadow-2xl ${cfg.bg} ${cfg.border} ${cfg.pulse ? 'animate-pulse' : ''}`}>
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                        <Icon className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">Incoming Call</p>
                        <p className="text-xs text-zinc-300 truncate">{incoming.initiator}</p>
                        <p className="text-xs text-zinc-400 truncate">{incoming.title}</p>
                        {incoming.priority_note && (
                            <p className="mt-1 text-xs italic text-orange-300 truncate">{incoming.priority_note}</p>
                        )}
                    </div>
                    {incoming.priority !== 'emergency' && (
                        <button onClick={() => decline(incoming.uid)} className="text-zinc-500 hover:text-zinc-300 transition">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                <div className="mt-4 flex gap-2">
                    <button onClick={() => answer(incoming.uid)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white transition hover:bg-green-500">
                        <Phone className="h-4 w-4" />Answer
                    </button>
                    {incoming.priority !== 'emergency' && (
                        <button onClick={() => decline(incoming.uid)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white transition hover:bg-red-500">
                            <PhoneOff className="h-4 w-4" />Decline
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

