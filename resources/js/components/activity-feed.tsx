// resources/js/components/activity-feed.tsx
// Shared between admin and client dashboards.

import {
    Activity, Plus, Pencil, Trash2, RotateCcw, Upload,
    Download, Share2, Send, Star, Globe, Lock, LogIn,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityEntry {
    id: number;
    event: string;
    description: string;
    module: string | null;
    icon: string;
    color: string;
    created_at: string;
    time_ago: string;
    causer?: { id: number; name: string; email: string } | null;
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
    LogIn, Plus, Pencil, Trash2, RotateCcw,
    Upload, Download, Share2, Send, Star,
    Globe, Lock, Activity,
};

function EventIcon({ name, className }: { name: string; className?: string }) {
    const Icon = ICON_MAP[name] ?? Activity;
    return <Icon className={className ?? 'h-3.5 w-3.5'} />;
}

// ─── Module badge ─────────────────────────────────────────────────────────────

const MODULE_COLORS: Record<string, string> = {
    drive:   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    vault:   'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    service: 'bg-green-500/10 text-green-600 dark:text-green-400',
    auth:    'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

function ModuleBadge({ module }: { module: string | null }) {
    if (!module) return null;
    const cls = MODULE_COLORS[module] ?? 'bg-muted/60 text-muted-foreground';
    return (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
            {module}
        </span>
    );
}

// ─── Single row ───────────────────────────────────────────────────────────────

function ActivityRow({ log, showCauser = false }: { log: ActivityEntry; showCauser?: boolean }) {
    return (
        <div className="flex items-start gap-3 border-b border-sidebar-border/40 py-3 last:border-0">
            {/* Icon dot */}
            <div className={`mt-0.5 shrink-0 rounded-full bg-muted/50 p-1.5 ${log.color}`}>
                <EventIcon name={log.icon} className="h-3 w-3" />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                    {showCauser && log.causer && (
                        <span className="font-medium text-sm">{log.causer.name}</span>
                    )}
                    <p className={`text-sm ${showCauser && log.causer ? 'text-muted-foreground' : ''}`}>
                        {log.description}
                    </p>
                    <ModuleBadge module={log.module} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{log.time_ago}</p>
            </div>
        </div>
    );
}

// ─── Feed component ───────────────────────────────────────────────────────────

interface ActivityFeedProps {
    logs: ActivityEntry[];
    showCauser?: boolean;   // true on admin (shows who did it)
    title?: string;
    limit?: number;         // show first N rows, rest hidden behind "show more"
}

export function ActivityFeed({
    logs,
    showCauser = false,
    title = 'Activity',
    limit = 10,
}: ActivityFeedProps) {
    const visible = logs.slice(0, limit);

    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card">
            {/* Header */}
            <div className="border-b p-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                        <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <p className="text-sm text-muted-foreground">
                            {logs.length === 0
                                ? 'No activity yet'
                                : `${logs.length} event${logs.length !== 1 ? 's' : ''} recorded`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="px-6 py-2">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <Activity className="h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                            Actions you take will appear here.
                        </p>
                    </div>
                ) : (
                    <>
                        {visible.map(log => (
                            <ActivityRow key={log.id} log={log} showCauser={showCauser} />
                        ))}
                        {logs.length > limit && (
                            <p className="py-3 text-center text-xs text-muted-foreground">
                                + {logs.length - limit} older events — check the full log for details.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
