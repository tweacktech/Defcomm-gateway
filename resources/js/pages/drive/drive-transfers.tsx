// resources/js/pages/drive/transfers.tsx
// Inertia view: 'drive/transfers'
// Route: GET /drive/transfers
//
// INCOMING — current user is recipient  → can Accept / Decline
// OUTGOING — current user is owner      → can Cancel

import { Head, usePage, router } from '@inertiajs/react';
import {
    Send, File, Folder, Globe, Lock, HardDrive, Star, Trash2,
    Shield, CheckCircle2, XCircle, Clock, ChevronRight,
    AlertTriangle, RefreshCw, Ban, Inbox,
    ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TransferStatus = 'pending' | 'accepted' | 'declined';
type Visibility     = 'private' | 'public';

interface TransferItem {
    id: number;
    name: string;
    type: 'folder' | 'file';
    size_human: string;
    visibility: Visibility;
}

interface TransferPerson {
    id: number;
    name: string;
    email: string;
}

interface Transfer {
    id: number;
    token: string;
    transfer_status: TransferStatus;
    is_active: boolean;
    created_at: string;
    created_ago: string;
    item: TransferItem | null;
    from: TransferPerson | null;
    to: TransferPerson | null;
}

type PageProps = {
    incoming: Transfer[];
    outgoing: Transfer[];
    usage: number;
    storage_limit: number;
    auth: { user: { id: number; name: string; email: string } };
} & Record<string, unknown>;

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Drive',     href: '/drive' },
    { title: 'Transfers', href: '/drive/transfers' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtUsage = (bytes: number) => {
    const gb = bytes / 1024 ** 3;
    return gb < 0.01 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${gb.toFixed(2)} GB`;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, isActive }: { status: TransferStatus; isActive: boolean }) {
    // Cancelled = pending but owner deactivated it
    if (!isActive && status === 'pending') return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <Ban className="h-3 w-3" />Cancelled
        </span>
    );

    const map = {
        pending:  { cls: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400', Icon: Clock,        label: 'Pending'  },
        accepted: { cls: 'bg-green-500/10 text-green-600 dark:text-green-400',    Icon: CheckCircle2, label: 'Accepted' },
        declined: { cls: 'bg-muted/60 text-muted-foreground',                     Icon: XCircle,      label: 'Declined' },
    } as const;

    const { cls, Icon, label } = map[status];
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
            <Icon className="h-3 w-3" />{label}
        </span>
    );
}

// ─── Item preview ─────────────────────────────────────────────────────────────

function ItemPreview({ item }: { item: TransferItem }) {
    return (
        <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-lg bg-muted/40 p-2">
                {item.type === 'folder'
                    ? <Folder className="h-5 w-5 text-yellow-400" />
                    : <File className="h-5 w-5 text-primary" />}
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="capitalize">{item.type}</span>
                    {item.type === 'file' && <><span>·</span><span>{item.size_human}</span></>}
                    <span>·</span>
                    {item.visibility === 'public' ? (
                        <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                            <Globe className="h-3 w-3" />Public
                        </span>
                    ) : (
                        <span className="flex items-center gap-0.5">
                            <Lock className="h-3 w-3" />Private
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Incoming Card ────────────────────────────────────────────────────────────

function IncomingCard({ transfer }: { transfer: Transfer }) {
    const [accepting, setAccepting]    = useState(false);
    const [declining, setDeclining]    = useState(false);
    const [confirmDec, setConfirmDec]  = useState(false);

    const isPending = transfer.transfer_status === 'pending' && transfer.is_active;

    const handleAccept = () => {
        setAccepting(true);
        router.post(`/drive/transfer/${transfer.token}/accept`, {}, {
            onFinish: () => setAccepting(false),
        });
    };

    const handleDecline = () => {
        setDeclining(true);
        router.post(`/drive/transfer/${transfer.token}/decline`, {}, {
            onFinish: () => { setDeclining(false); setConfirmDec(false); },
        });
    };

    return (
        <div className={`flex flex-col rounded-xl border bg-card p-5 transition
            ${!isPending ? 'border-sidebar-border/40 opacity-75' : 'border-sidebar-border/70'}`}>

            {/* Header row */}
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-blue-500/10 p-2 shrink-0">
                        <ArrowDownToLine className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">From</p>
                        <p className="truncate text-sm font-semibold">{transfer.from?.name ?? 'Unknown'}</p>
                        <p className="truncate text-xs text-muted-foreground">{transfer.from?.email}</p>
                    </div>
                </div>
                <StatusBadge status={transfer.transfer_status} isActive={transfer.is_active} />
            </div>

            {/* Item */}
            {transfer.item && (
                <div className="mb-3 rounded-lg bg-muted/20 p-3">
                    <ItemPreview item={transfer.item} />
                </div>
            )}

            <p className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />Received {transfer.created_ago}
            </p>

            {/* Pending actions */}
            {isPending && !confirmDec && (
                <div className="mt-auto flex gap-2">
                    <Button size="sm" onClick={handleAccept}
                        disabled={accepting || declining} className="flex-1 gap-1.5">
                        {accepting
                            ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Accepting…</>
                            : <><CheckCircle2 className="h-3.5 w-3.5" />Accept</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmDec(true)}
                        disabled={accepting || declining}
                        className="flex-1 gap-1.5 text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" />Decline
                    </Button>
                </div>
            )}

            {/* Decline confirm */}
            {isPending && confirmDec && (
                <div className="mt-auto rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                    <p className="text-xs text-red-600 dark:text-red-400">
                        The file stays with {transfer.from?.name}. Confirm?
                    </p>
                    <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={handleDecline}
                            disabled={declining} className="gap-1.5">
                            {declining
                                ? <><RefreshCw className="h-3 w-3 animate-spin" />Declining…</>
                                : <><XCircle className="h-3 w-3" />Yes, Decline</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDec(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Resolution states */}
            {transfer.transfer_status === 'accepted' && (
                <p className="mt-auto flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Item is in your Drive.{' '}
                    <button onClick={() => router.get('/services/drive')}
                        className="underline underline-offset-2 hover:no-underline">
                        Open Drive
                    </button>
                </p>
            )}
            {transfer.transfer_status === 'declined' && (
                <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />You declined this transfer.
                </p>
            )}
            {!transfer.is_active && transfer.transfer_status === 'pending' && (
                <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Ban className="h-3.5 w-3.5 shrink-0" />Offer cancelled by sender.
                </p>
            )}
        </div>
    );
}

// ─── Outgoing Card ────────────────────────────────────────────────────────────

function OutgoingCard({ transfer }: { transfer: Transfer }) {
    const [cancelling, setCancelling]  = useState(false);
    const [confirmCan, setConfirmCan]  = useState(false);

    const isPending = transfer.transfer_status === 'pending' && transfer.is_active;

    const handleCancel = () => {
        setCancelling(true);
        router.delete(`/drive/transfer/${transfer.token}/cancel`, {
            onFinish: () => { setCancelling(false); setConfirmCan(false); },
        });
    };

    return (
        <div className={`flex flex-col rounded-xl border bg-card p-5 transition
            ${!isPending ? 'border-sidebar-border/40 opacity-75' : 'border-sidebar-border/70'}`}>

            {/* Header row */}
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-purple-500/10 p-2 shrink-0">
                        <ArrowUpFromLine className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">To</p>
                        <p className="truncate text-sm font-semibold">{transfer.to?.name ?? 'Unknown'}</p>
                        <p className="truncate text-xs text-muted-foreground">{transfer.to?.email}</p>
                    </div>
                </div>
                <StatusBadge status={transfer.transfer_status} isActive={transfer.is_active} />
            </div>

            {/* Item */}
            {transfer.item && (
                <div className="mb-3 rounded-lg bg-muted/20 p-3">
                    <ItemPreview item={transfer.item} />
                </div>
            )}

            <p className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />Sent {transfer.created_ago}
            </p>

            {/* Cancel action */}
            {isPending && !confirmCan && (
                <button onClick={() => setConfirmCan(true)}
                    className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-destructive">
                    <Ban className="h-3.5 w-3.5" />Cancel transfer offer
                </button>
            )}

            {isPending && confirmCan && (
                <div className="mt-auto rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                    <p className="text-xs text-red-600 dark:text-red-400">
                        Cancel? {transfer.to?.name} will no longer be able to accept.
                    </p>
                    <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={handleCancel}
                            disabled={cancelling} className="gap-1.5">
                            {cancelling
                                ? <><RefreshCw className="h-3 w-3 animate-spin" />Cancelling…</>
                                : <><Ban className="h-3 w-3" />Yes, Cancel</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmCan(false)}>
                            Keep
                        </Button>
                    </div>
                </div>
            )}

            {/* Resolution states */}
            {transfer.transfer_status === 'accepted' && (
                <p className="mt-auto flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    {transfer.to?.name} accepted — item transferred.
                </p>
            )}
            {transfer.transfer_status === 'declined' && (
                <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />{transfer.to?.name} declined.
                </p>
            )}
            {!transfer.is_active && transfer.transfer_status === 'pending' && (
                <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Ban className="h-3.5 w-3.5 shrink-0" />You cancelled this offer.
                </p>
            )}
        </div>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, count, accent, emptyIcon, emptyTitle, emptyMsg, children }: {
    title: string;
    count: number;
    accent: React.ReactNode;
    emptyIcon: React.ReactNode;
    emptyTitle: string;
    emptyMsg: string;
    children: React.ReactNode;
}) {
    return (
        <div className="mb-10">
            <div className="mb-4 flex items-center gap-2">
                {accent}
                <h2 className="font-semibold">{title}</h2>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                    {count}
                </span>
            </div>

            {count === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-sidebar-border/50 py-10 text-center">
                    <div className="text-muted-foreground/30">{emptyIcon}</div>
                    <p className="text-sm font-medium">{emptyTitle}</p>
                    <p className="text-xs text-muted-foreground">{emptyMsg}</p>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Transfers() {
    const { incoming: rawIn, outgoing: rawOut, usage, storage_limit } =
        usePage<PageProps>().props;

    // Guard against undefined on partial reloads
    const incoming: Transfer[] = Array.isArray(rawIn)  ? rawIn  : [];
    const outgoing: Transfer[] = Array.isArray(rawOut) ? rawOut : [];

    const storageLimit    = storage_limit ?? 2 * 1024 ** 3;
    const usagePct        = Math.min((usage / storageLimit) * 100, 100);
    const pendingIncoming = incoming.filter(t => t.transfer_status === 'pending' && t.is_active).length;

    const stats = [
        { label: 'Incoming pending',  value: pendingIncoming,                                                       color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-500/10'  },
        { label: 'Incoming accepted', value: incoming.filter(t => t.transfer_status === 'accepted').length,          color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-500/10'   },
        { label: 'Outgoing pending',  value: outgoing.filter(t => t.transfer_status === 'pending' && t.is_active).length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10'  },
        { label: 'Outgoing total',    value: outgoing.length,                                                         color: 'text-muted-foreground',               bg: 'bg-muted/40'       },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Transfers — Drive" />

            <div className="flex flex-1 overflow-hidden">

                {/* ── Sidebar ─────────────────────────────────────────────── */}
                <aside className="hidden w-56 flex-shrink-0 flex-col gap-1 border-r border-sidebar-border/50 bg-card p-4 lg:flex">
                    {([
                        { label: 'My Drive',  icon: HardDrive, href: '/services/drive',           active: false },
                        { label: 'Starred',   icon: Star,      href: '/drive/starred',   active: false },
                        { label: 'Transfers', icon: Send,      href: '/drive/transfers', active: true  },
                        { label: 'Trash',     icon: Trash2,    href: '/drive/trash',     active: false },
                    ] as const).map(nav => (
                        <button key={nav.label} onClick={() => router.get(nav.href)}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition
                                ${nav.active
                                    ? 'bg-primary/10 font-medium text-primary'
                                    : 'text-muted-foreground hover:bg-accent/50'}`}>
                            <nav.icon className="h-4 w-4" />
                            {nav.label}
                            {nav.label === 'Transfers' && pendingIncoming > 0 && (
                                <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                    {pendingIncoming}
                                </span>
                            )}
                        </button>
                    ))}

                    {/* Storage meter */}
                    <div className="mt-auto rounded-xl border border-sidebar-border/50 bg-muted/30 p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                            <p className="text-xs font-medium">Storage</p>
                            <Shield className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full transition-all
                                ${usagePct >= 95 ? 'bg-red-500' : usagePct >= 80 ? 'bg-yellow-500' : 'bg-primary'}`}
                                style={{ width: `${usagePct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {fmtUsage(usage)}
                            <span className="text-muted-foreground/60"> / {fmtUsage(storageLimit)}</span>
                        </p>
                    </div>
                </aside>

                {/* ── Main ────────────────────────────────────────────────── */}
                <main className="flex flex-1 flex-col overflow-auto p-6">

                    {/* Header */}
                    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-sm">
                                <button onClick={() => router.get('/drive')}
                                    className="text-muted-foreground hover:text-foreground">
                                    <HardDrive className="h-4 w-4" />
                                </button>
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                <h1 className="text-base font-bold">Transfers</h1>
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                Manage ownership transfers of your files and folders.
                            </p>
                        </div>
                        {pendingIncoming > 0 && (
                            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
                                <Inbox className="h-4 w-4 shrink-0" />
                                {pendingIncoming} pending offer{pendingIncoming !== 1 ? 's' : ''} awaiting response
                            </div>
                        )}
                    </div>

                    {/* Stats strip */}
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {stats.map(({ label, value, color, bg }) => (
                            <div key={label}
                                className={`rounded-xl border border-sidebar-border/70 ${bg} px-4 py-3`}>
                                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                                <p className="text-xs text-muted-foreground">{label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Incoming */}
                    <Section
                        title="Incoming"
                        count={incoming.length}
                        accent={<ArrowDownToLine className="h-5 w-5 text-blue-500" />}
                        emptyIcon={<ArrowDownToLine className="h-10 w-10" />}
                        emptyTitle="No incoming transfers"
                        emptyMsg="When someone sends you a file transfer, it will appear here."
                    >
                        {incoming.map(t => <IncomingCard key={t.id} transfer={t} />)}
                    </Section>

                    {/* Outgoing */}
                    <Section
                        title="Outgoing"
                        count={outgoing.length}
                        accent={<ArrowUpFromLine className="h-5 w-5 text-purple-500" />}
                        emptyIcon={<ArrowUpFromLine className="h-10 w-10" />}
                        emptyTitle="No outgoing transfers"
                        emptyMsg='Right-click a file → "Share & Visibility" → Transfer tab to send one.'
                    >
                        {outgoing.map(t => <OutgoingCard key={t.id} transfer={t} />)}
                    </Section>

                    {/* Info note */}
                    {(incoming.length > 0 || outgoing.length > 0) && (
                        <div className="flex items-start gap-2 rounded-lg border border-sidebar-border/50 bg-muted/20 px-4 py-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                                Accepting a transfer permanently moves the item into your Drive.
                                Once accepted, the original owner loses access and the action cannot be reversed.
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </AppLayout>
    );
}
