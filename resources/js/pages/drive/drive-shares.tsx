import { Head, usePage, router } from '@inertiajs/react';
import {
    Share2, Link, Send, Trash2, ChevronLeft, Globe, Lock,
    File, Folder, Clock, KeyRound, Eye, Download, UserCheck,
    CheckCircle2, XCircle, AlertTriangle, Copy, Check, Users,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Visibility      = 'private' | 'public';
type ShareType       = 'link' | 'transfer';
type SharePermission = 'view' | 'download';
type TransferStatus  = 'pending' | 'accepted' | 'declined' | null;

interface DriveItemMeta {
    id: number;
    name: string;
    type: 'folder' | 'file';
    visibility: Visibility;
}

interface ShareRecord {
    id: number;
    type: ShareType;
    token: string;
    url: string;
    permission: SharePermission;
    has_password: boolean;
    max_uses: number | null;
    use_count: number;
    expires_at: string | null;
    is_active: boolean;
    is_expired: boolean;
    is_exhausted: boolean;
    transfer_status: TransferStatus;
    recipient: { id: number; name: string; email: string } | null;
    created_at: string;
}

type PageProps = {
    item: DriveItemMeta;
    shares: ShareRecord[];
    auth: { user: { id: number } };
} & Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });

const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    });
}

// ─── Share Status Badge ───────────────────────────────────────────────────────

function ShareStatusBadge({ share }: { share: ShareRecord }) {
    if (!share.is_active) return (
        <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Revoked
        </span>
    );
    if (share.is_expired) return (
        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
            Expired
        </span>
    );
    if (share.is_exhausted) return (
        <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
            Exhausted
        </span>
    );
    if (share.type === 'transfer') {
        const cls: Record<string, string> = {
            pending:  'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
            accepted: 'bg-green-500/10 text-green-600 dark:text-green-400',
            declined: 'bg-muted/60 text-muted-foreground',
        };
        return (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize
                ${cls[share.transfer_status ?? 'pending']}`}>
                {share.transfer_status}
            </span>
        );
    }
    return (
        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            Active
        </span>
    );
}

// ─── Share Card ───────────────────────────────────────────────────────────────

function ShareCard({ share }: { share: ShareRecord }) {
    const [copied, setCopied]   = useState(false);
    const [confirm, setConfirm] = useState(false);

    const isLink   = share.type === 'link';
    const isUsable = share.is_active && !share.is_expired && !share.is_exhausted;

    const handleCopy = () => {
        copyToClipboard(share.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRevoke = () => {
        router.delete(`/drive/shares/${share.id}`, { preserveScroll: true });
        setConfirm(false);
    };

    return (
        <div className={`rounded-xl border bg-card p-5 transition
            ${!isUsable ? 'border-sidebar-border/40 opacity-70' : 'border-sidebar-border/70'}`}>

            {/* Header */}
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className={`rounded-lg p-2 ${isLink ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
                        {isLink
                            ? <Link className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            : <Send className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{isLink ? 'Share Link' : 'Transfer'}</p>
                        <p className="text-xs text-muted-foreground">
                            Created {fmtDate(share.created_at)}
                        </p>
                    </div>
                </div>
                <ShareStatusBadge share={share} />
            </div>

            {/* Link-specific info */}
            {isLink && (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {share.permission === 'view'
                            ? <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />View only</span>
                            : <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />Can download</span>}
                        {share.has_password && (
                            <span className="flex items-center gap-1">
                                <KeyRound className="h-3.5 w-3.5" />Password protected
                            </span>
                        )}
                    </div>

                    {/* Usage bar */}
                    <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{share.use_count} use{share.use_count !== 1 ? 's' : ''}</span>
                                <span>
                                    {share.max_uses != null ? `/ ${share.max_uses} max` : 'Unlimited'}
                                </span>
                            </div>
                            {share.max_uses != null && (
                                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-primary transition-all"
                                        style={{
                                            width: `${Math.min((share.use_count / share.max_uses) * 100, 100)}%`,
                                        }} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Expiry */}
                    {share.expires_at && (
                        <p className={`flex items-center gap-1.5 text-xs
                            ${share.is_expired ? 'text-red-500' : 'text-muted-foreground'}`}>
                            <Clock className="h-3.5 w-3.5" />
                            {share.is_expired ? 'Expired' : 'Expires'} {fmtDateTime(share.expires_at)}
                        </p>
                    )}

                    {/* URL + copy */}
                    {isUsable && (
                        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                            <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                {share.url}
                            </code>
                            <button onClick={handleCopy}
                                className="shrink-0 rounded p-1 transition hover:bg-accent/80">
                                {copied
                                    ? <Check className="h-3.5 w-3.5 text-green-500" />
                                    : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Transfer-specific info */}
            {!isLink && share.recipient && (
                <div className="flex items-center gap-2.5 rounded-lg bg-muted/20 px-3 py-2.5">
                    <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{share.recipient.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{share.recipient.email}</p>
                    </div>
                    {share.transfer_status === 'accepted' && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    )}
                    {share.transfer_status === 'declined' && (
                        <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                </div>
            )}

            {/* Revoke action */}
            {share.is_active && share.transfer_status !== 'accepted' && (
                <div className="mt-4 border-t border-sidebar-border/40 pt-3">
                    {!confirm ? (
                        <button onClick={() => setConfirm(true)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                            {isLink ? 'Revoke link' : 'Cancel transfer'}
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">Are you sure?</p>
                            <Button size="sm" variant="destructive" onClick={handleRevoke}
                                className="h-6 gap-1 px-2 text-xs">
                                <Trash2 className="h-3 w-3" />Revoke
                            </Button>
                            <button onClick={() => setConfirm(false)}
                                className="text-xs text-muted-foreground hover:text-foreground">
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriveShares() {
    const { item, shares: rawShares } = usePage<PageProps>().props;

    // Guard: shares may arrive undefined on partial Inertia reload
    const shares: ShareRecord[] = Array.isArray(rawShares) ? rawShares : [];

    // Guard: item may be undefined during SSR or error states
    if (!item) return null;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Drive',   href: '/drive' },
        {
            title: item.name,
            href: item.type === 'folder' ? `/drive/folder/${item.id}` : '/drive',
        },
        { title: 'Shares',  href: `/drive/items/${item.id}/shares` },
    ];

    const links       = shares.filter(s => s.type === 'link');
    const transfers   = shares.filter(s => s.type === 'transfer');
    const activeCount = shares.filter(
        s => s.is_active && !s.is_expired && !s.is_exhausted
    ).length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Shares — ${item.name}`} />

            <div className="mx-auto max-w-3xl p-6">

                {/* Back */}
                <button onClick={() => router.get('/drive')}
                    className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
                    <ChevronLeft className="h-4 w-4" />Back to Drive
                </button>

                {/* Item header card */}
                <div className="mb-6 flex items-center gap-4 rounded-xl border border-sidebar-border/70 bg-card p-5">
                    <div className="rounded-xl bg-muted/40 p-3">
                        {item.type === 'folder'
                            ? <Folder className="h-6 w-6 text-yellow-400" />
                            : <File className="h-6 w-6 text-primary" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-lg font-bold">{item.name}</h1>
                        <div className="mt-1 flex items-center gap-2">
                            <span className="text-sm capitalize text-muted-foreground">
                                {item.type}
                            </span>
                            <span className="text-muted-foreground">·</span>
                            {item.visibility === 'public' ? (
                                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                                    <Globe className="h-3.5 w-3.5" />Public
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Lock className="h-3.5 w-3.5" />Private
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="shrink-0 text-right">
                        <p className="text-2xl font-bold">{activeCount}</p>
                        <p className="text-xs text-muted-foreground">
                            active share{activeCount !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* Empty state */}
                {shares.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-sidebar-border/50 py-16 text-center">
                        <Share2 className="h-10 w-10 text-muted-foreground/30" />
                        <p className="font-semibold">No shares yet</p>
                        <p className="max-w-xs text-sm text-muted-foreground">
                            Go back to Drive and use the Share button to create a link or transfer ownership.
                        </p>
                        <button onClick={() => router.get('/drive')}
                            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition">
                            Back to Drive
                        </button>
                    </div>
                )}

                {/* Share Links */}
                {links.length > 0 && (
                    <div className="mb-8">
                        <div className="mb-3 flex items-center gap-2">
                            <Link className="h-4 w-4 text-blue-500" />
                            <h2 className="font-semibold">Share Links</h2>
                            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                                {links.length}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {links.map(s => <ShareCard key={s.id} share={s} />)}
                        </div>
                    </div>
                )}

                {/* Transfers */}
                {transfers.length > 0 && (
                    <div>
                        <div className="mb-3 flex items-center gap-2">
                            <Send className="h-4 w-4 text-purple-500" />
                            <h2 className="font-semibold">Transfers</h2>
                            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
                                {transfers.length}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {transfers.map(s => <ShareCard key={s.id} share={s} />)}
                        </div>
                    </div>
                )}

                {/* Info note */}
                {shares.length > 0 && (
                    <div className="mt-6 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                        <p className="text-xs text-yellow-700 dark:text-yellow-400">
                            Revoking a share link immediately prevents access even for people who already
                            have the URL. Accepted transfers cannot be revoked.
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
