import { Hourglass, UserCheck, X } from 'lucide-react';
import type { WaitingPeer } from '@/hooks/useWebRTCMesh';

type Props = {
  list: WaitingPeer[];
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
};

export default function WaitingApprovalPanel({ list, onAdmit, onDeny }: Props) {
  if (!list.length) return null;

  return (
    <div className="absolute top-16 left-1/2 z-30 w-80 -translate-x-1/2 rounded-2xl border border-yellow-500/25 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-yellow-400 uppercase">
        <Hourglass className="h-3.5 w-3.5" /> {list.length} waiting to join
      </p>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {list.map((p) => (
          <div key={p.peer_id} className="flex items-center gap-3 rounded-xl bg-zinc-800 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
              {p.display_name[0]?.toUpperCase()}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">{p.display_name}</span>
            <button onClick={() => onAdmit(p.peer_id)} className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600/20 text-green-400 transition hover:bg-green-600 hover:text-white">
              <UserCheck className="h-4 w-4" />
            </button>
            <button onClick={() => onDeny(p.peer_id)} className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600/20 text-red-400 transition hover:bg-red-600 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
