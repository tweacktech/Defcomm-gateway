import { Head, usePage, router } from '@inertiajs/react';
import {
    File, Folder, Download, Eye, Lock, Globe, Clock,
    AlertTriangle, ShieldX, TimerOff, XCircle,
    KeyRound, ArrowLeft, Check, RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShareMeta {
    id: number;
    token: string;
    permission: 'view' | 'download';
    has_password: boolean;
    needs_unlock: boolean;
    expires_at: string | null;
    use_count: number;
    max_uses: number | null;
}

interface ItemMeta {
    id: number;
    name: string;
    type: 'folder' | 'file';
    size: number;
    size_human: string;
    mime_type: string | null;
    extension: string | null;
}

type AccessPageProps = {
    share: ShareMeta;
    item: ItemMeta | null;   // null when password is required
} & Record<string, unknown>;

type ExpiredPageProps = {
    reason: 'expired' | 'exhausted' | 'revoked';
} & Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

// ─── Shell (used by both pages) ───────────────────────────────────────────────

function PublicShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                {/* Brand mark */}
                <div className="mb-8 flex items-center justify-center gap-2">
                    <div className="rounded-lg bg-primary/10 p-2">
                        <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground">Shared File</span>
                </div>
                {children}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARE ACCESS PAGE  — GET /s/{token}
// ═══════════════════════════════════════════════════════════════════════════════

export function ShareAccess() {
    const { share, item } = usePage<AccessPageProps>().props;

    const [password, setPassword]   = useState('');
    const [unlocking, setUnlocking] = useState(false);
    const [error, setError]         = useState('');

    const handleUnlock = () => {
        if (!password.trim()) return;
        setUnlocking(true);
        setError('');
        router.post(`/s/${share.token}/unlock`, { password }, {
            onError: () => {
                setUnlocking(false);
                setError('Incorrect password. Please try again.');
            },
            onFinish: () => setUnlocking(false),
        });
    };

    // ── Password gate ─────────────────────────────────────────────────────────
    if (share.needs_unlock) {
        return (
            <PublicShell>
                <Head title="Protected Share" />
                <div className="rounded-2xl border border-sidebar-border/70 bg-card p-8 shadow-xl">
                    <div className="mb-6 flex flex-col items-center gap-3 text-center">
                        <div className="rounded-full bg-primary/10 p-4">
                            <Lock className="h-7 w-7 text-primary" />
                        </div>
                        <h1 className="text-xl font-bold">Password Required</h1>
                        <p className="text-sm text-muted-foreground">
                            This shared file is password-protected. Enter the password to continue.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Label className="mb-1 block text-xs font-medium">Password</Label>
                            <Input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
                                placeholder="Enter password…"
                                className="h-10"
                                autoFocus
                            />
                            {error && (
                                <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                                    <XCircle className="h-3.5 w-3.5" />{error}
                                </p>
                            )}
                        </div>

                        <Button onClick={handleUnlock}
                            disabled={!password.trim() || unlocking}
                            className="w-full gap-2">
                            {unlocking
                                ? <><RefreshCw className="h-4 w-4 animate-spin" />Verifying…</>
                                : <><KeyRound className="h-4 w-4" />Unlock</>}
                        </Button>
                    </div>
                </div>
            </PublicShell>
        );
    }

    if (!item) return null;

    const isFile      = item.type === 'file';
    const canDownload = share.permission === 'download' && isFile;

    // ── File/folder preview ───────────────────────────────────────────────────
    return (
        <PublicShell>
            <Head title={`${item.name} — Shared File`} />

            <div className="rounded-2xl border border-sidebar-border/70 bg-card p-8 shadow-xl">
                {/* Item info */}
                <div className="mb-6 flex flex-col items-center gap-3 text-center">
                    <div className="rounded-2xl bg-muted/40 p-5">
                        {item.type === 'folder'
                            ? <Folder className="h-12 w-12 text-yellow-400" />
                            : <File className="h-12 w-12 text-primary" />}
                    </div>
                    <div>
                        <h1 className="break-all text-xl font-bold">{item.name}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {item.type === 'file' ? item.size_human : 'Folder'}{item.extension ? ` · .${item.extension}` : ''}
                        </p>
                    </div>
                </div>

                {/* Permission badge */}
                <div className="mb-5 flex justify-center">
                    {canDownload ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                            <Download className="h-3.5 w-3.5" />Download enabled
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-sm font-medium text-muted-foreground">
                            <Eye className="h-3.5 w-3.5" />View only
                        </span>
                    )}
                </div>

                {/* Usage + expiry info */}
                <div className="mb-6 space-y-2 rounded-xl bg-muted/20 p-4 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                        <span>Access count</span>
                        <span className="font-medium text-foreground">
                            {share.use_count}{share.max_uses != null ? ` / ${share.max_uses}` : ''}
                        </span>
                    </div>
                    {share.expires_at && (
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Expires</span>
                            <span className="font-medium text-foreground">{fmtDateTime(share.expires_at)}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="space-y-2">
                    {canDownload && (
                        <a href={`/s/${share.token}/download`}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                            <Download className="h-5 w-5" />Download File
                        </a>
                    )}
                    {!canDownload && isFile && (
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-sidebar-border/50 bg-muted/20 py-3 text-sm text-muted-foreground">
                            <Eye className="h-4 w-4" />Download not permitted for this share
                        </div>
                    )}
                    {!isFile && (
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-sidebar-border/50 bg-muted/20 py-3 text-sm text-muted-foreground">
                            <Folder className="h-4 w-4 text-yellow-400" />Folder — contents not listed in public share
                        </div>
                    )}
                </div>

                <p className="mt-6 text-center text-xs text-muted-foreground/60">
                    Shared securely via Drive
                </p>
            </div>
        </PublicShell>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARE EXPIRED PAGE  — rendered when share is no longer usable
// ═══════════════════════════════════════════════════════════════════════════════

export function ShareExpired() {
    const { reason } = usePage<ExpiredPageProps>().props;

    const configs = {
        expired: {
            icon: <TimerOff className="h-8 w-8 text-yellow-500" />,
            bg: 'bg-yellow-500/10',
            title: 'Link Expired',
            message: 'This share link has passed its expiry date and is no longer accessible.',
        },
        exhausted: {
            icon: <XCircle className="h-8 w-8 text-orange-500" />,
            bg: 'bg-orange-500/10',
            title: 'Usage Limit Reached',
            message: 'This share link has been used the maximum number of times allowed.',
        },
        revoked: {
            icon: <ShieldX className="h-8 w-8 text-red-500" />,
            bg: 'bg-red-500/10',
            title: 'Link Revoked',
            message: 'This share link has been revoked by the owner and is no longer valid.',
        },
    } as const;

    const { icon, bg, title, message } = configs[reason] ?? configs.revoked;

    return (
        <PublicShell>
            <Head title="Share Link Unavailable" />

            <div className="rounded-2xl border border-sidebar-border/70 bg-card p-10 text-center shadow-xl">
                <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${bg}`}>
                    {icon}
                </div>

                <h1 className="mb-2 text-xl font-bold">{title}</h1>
                <p className="mb-6 text-sm text-muted-foreground">{message}</p>

                <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-left">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        If you believe this is a mistake, please contact the person who shared this link with you.
                    </p>
                </div>
            </div>
        </PublicShell>
    );
}
