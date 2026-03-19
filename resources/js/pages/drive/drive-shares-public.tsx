// resources/js/pages/drive/drive-shares.tsx
// Inertia view: 'drive/drive-shares'
// Route: GET /s/{token}  (public — no auth required)
// Handles both the password-unlock gate and the file access view.

import { Head, usePage, router } from '@inertiajs/react';
import {
    File, Folder, Download, Eye, Lock, Globe, Clock,
    KeyRound, XCircle, RefreshCw, Check, Shield,
    FileText, FileImage, FileVideo, FileAudio, Users,
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

type PageProps = {
    share: ShareMeta;
    item: ItemMeta | null;
} & Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

function ItemIcon({ item }: { item: ItemMeta }) {
    const cls = 'h-14 w-14';
    if (item.type === 'folder') return <Folder className={`${cls} text-yellow-400`} />;
    const mime = item.mime_type ?? '';
    if (mime.startsWith('image/'))  return <FileImage className={`${cls} text-blue-400`} />;
    if (mime.startsWith('video/'))  return <FileVideo className={`${cls} text-purple-400`} />;
    if (mime.startsWith('audio/'))  return <FileAudio className={`${cls} text-pink-400`} />;
    if (mime.includes('pdf'))       return <FileText className={`${cls} text-red-400`} />;
    return <File className={`${cls} text-primary`} />;
}

// ─── Layout shell (no auth, no sidebar) ──────────────────────────────────────

function PublicShell({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Head title={title} />

            {/* Brand */}
            <div className="mb-6 flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                    <Shield className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-muted-foreground">Secure Drive Share</span>
            </div>

            <div className="w-full max-w-md">{children}</div>

            <p className="mt-8 text-center text-xs text-muted-foreground/50">
                Powered by Drive · End-to-end encrypted tokens
            </p>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD GATE
// ═══════════════════════════════════════════════════════════════════════════════

function PasswordGate({ token }: { token: string }) {
    const [password, setPassword] = useState('');
    const [unlocking, setUnlocking] = useState(false);
    const [error, setError] = useState('');

    const handleUnlock = () => {
        if (!password.trim()) return;
        setUnlocking(true);
        setError('');
        router.post(`/s/${token}/unlock`, { password }, {
            onError: (errs) => {
                setUnlocking(false);
                setError(errs.password ?? 'Incorrect password. Please try again.');
            },
            onFinish: () => setUnlocking(false),
        });
    };

    return (
        <PublicShell title="Protected Share">
            <div className="rounded-2xl border border-sidebar-border/70 bg-card p-8 shadow-xl">
                {/* Icon */}
                <div className="mb-6 flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Password Protected</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Enter the password to access this shared file.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <Label className="mb-1.5 block text-xs font-medium">Password</Label>
                        <div className="relative">
                            <KeyRound className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
                                placeholder="Enter password…"
                                className="h-11 pl-9"
                                autoFocus
                            />
                        </div>
                        {error && (
                            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                                <XCircle className="h-3.5 w-3.5 shrink-0" />{error}
                            </p>
                        )}
                    </div>

                    <Button onClick={handleUnlock}
                        disabled={!password.trim() || unlocking}
                        className="w-full gap-2 h-11">
                        {unlocking
                            ? <><RefreshCw className="h-4 w-4 animate-spin" />Verifying…</>
                            : <><KeyRound className="h-4 w-4" />Unlock File</>}
                    </Button>
                </div>
            </div>
        </PublicShell>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE ACCESS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function FileAccess({ share, item }: { share: ShareMeta; item: ItemMeta }) {
    const canDownload = share.permission === 'download' && item.type === 'file';
    const isExpiringSoon = share.expires_at
        ? new Date(share.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000
        : false;

    return (
        <PublicShell title={`${item.name} — Shared File`}>
            <div className="rounded-2xl border border-sidebar-border/70 bg-card shadow-xl overflow-hidden">

                {/* File hero */}
                <div className="flex flex-col items-center gap-3 bg-muted/20 px-8 py-10 text-center">
                    <ItemIcon item={item} />
                    <div>
                        <h1 className="break-all text-xl font-bold leading-tight">{item.name}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {item.type === 'file'
                                ? `${item.size_human}${item.extension ? ` · .${item.extension.toUpperCase()}` : ''}`
                                : 'Folder'}
                        </p>
                    </div>

                    {/* Permission badge */}
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

                {/* Meta info */}
                <div className="space-y-2 border-t border-sidebar-border/50 px-6 py-4 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />Access count
                        </span>
                        <span className="font-medium text-foreground">
                            {share.use_count}
                            {share.max_uses != null && (
                                <span className="text-muted-foreground"> / {share.max_uses} max</span>
                            )}
                        </span>
                    </div>

                    {share.max_uses != null && (
                        <div className="h-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min((share.use_count / share.max_uses) * 100, 100)}%` }} />
                        </div>
                    )}

                    {share.expires_at && (
                        <div className={`flex items-center justify-between ${isExpiringSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
                            <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {isExpiringSoon ? 'Expires soon' : 'Expires'}
                            </span>
                            <span className="font-medium">{fmtDateTime(share.expires_at)}</span>
                        </div>
                    )}
                </div>

                {/* Action */}
                <div className="border-t border-sidebar-border/50 p-6">
                    {canDownload ? (
                        <a href={`/s/${share.token}/download`}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                            <Download className="h-5 w-5" />Download File
                        </a>
                    ) : item.type === 'file' ? (
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-sidebar-border/50 bg-muted/20 py-3.5 text-sm text-muted-foreground">
                            <Eye className="h-4 w-4" />Download not permitted for this share
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-sidebar-border/50 bg-muted/20 py-3.5 text-sm text-muted-foreground">
                            <Folder className="h-4 w-4 text-yellow-400" />Folder contents not listed in shared view
                        </div>
                    )}
                </div>
            </div>
        </PublicShell>
    );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function DriveSharesPublic() {
    const { share, item } = usePage<PageProps>().props;

    if (share.needs_unlock) {
        return <PasswordGate token={share.token} />;
    }

    if (!item) return null;

    return <FileAccess share={share} item={item} />;
}
