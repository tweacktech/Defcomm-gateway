// ═══════════════════════════════════════════════════════════════════════════════
// resources/js/pages/calls/ended.tsx
// ═══════════════════════════════════════════════════════════════════════════════

import { Head, usePage, router } from '@inertiajs/react';
import { PhoneOff, Phone, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CallInfo {
    uid: string; title: string; status: string; priority: string;
    initiator_name: string; duration_seconds: number | null;
}
type PageProps = { call: CallInfo } & Record<string, unknown>;

const fmtDur = (s: number | null) => {
    if (!s) return '—';
    return `${Math.floor(s / 60)}m ${s % 60}s`;
};

export function CallsEnded() {
    const { call } = usePage<PageProps>().props;
    const statusMsg: Record<string, [string, string]> = {
        ended:   ['📴', 'Call ended'],
        missed:  ['📵', 'Call missed'],
        declined:['❌', 'Call declined'],
    };
    const [icon, label] = statusMsg[call.status] ?? ['📴', 'Call ended'];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-zinc-950 text-white">
            <Head title={`${label} — ${call.title}`} />
            <span className="text-5xl">{icon}</span>
            <div className="text-center">
                <p className="text-xl font-bold">{label}</p>
                <p className="mt-1 text-sm text-zinc-400">{call.title}</p>
                <p className="mt-0.5 text-xs text-zinc-600">with {call.initiator_name}</p>
                {call.duration_seconds !== null && (
                    <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
                        <Clock className="h-3.5 w-3.5" />Duration: {fmtDur(call.duration_seconds)}
                    </p>
                )}
            </div>
            <Button onClick={() => router.get('/calls')} variant="outline"
                className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                <Phone className="h-4 w-4" />Back to Calls
            </Button>
        </div>
    );
}

export default CallsEnded;

