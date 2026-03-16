import { Head, usePage, router } from '@inertiajs/react';


import {
    Folder, FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
    FolderPlus, Upload, Download, Star, Trash2, RotateCcw,
    Pencil, X, Check, ChevronRight, Home, Grid3x3,
    List, Search, HardDrive, Move, Share2, Lock, Globe,
    Link, Send, Eye, EyeOff, Copy, UserCheck, Clock,
    AlertTriangle, Shield,
} from 'lucide-react';
import { useState, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';


// ─── Types ────────────────────────────────────────────────────────────────────

type Visibility = 'private' | 'public';

interface DriveItem {
    id: number;
    parent_id: number | null;
    type: 'folder' | 'file';
    name: string;
    mime_type?: string | null;
    size: number;
    extension?: string | null;
    is_starred: boolean;
    visibility: Visibility;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

interface FolderNode {
    id: number;
    name: string;
    parent_id: number | null;
}

interface BreadcrumbNode {
    id: number;
    name: string;
}

type ViewMode    = 'my-drive' | 'starred' | 'trash';
type DisplayMode = 'grid' | 'list';
type ShareTab    = 'link' | 'transfer';

// Default 2 GB — overridden by `storage_limit` page prop from the controller
const DEFAULT_STORAGE_LIMIT = 2 * 1024 ** 3;

type PageProps = {
    folder: FolderNode | null;
    items: DriveItem[];
    breadcrumbs: BreadcrumbNode[];
    usage: number;
    storage_limit: number;   // bytes, sent from controller — change per user/plan
    view?: ViewMode;
    auth: { user: { id: number; name: string; email: string } };
    flash?: { success?: string; share_url?: string; info?: string };
} & Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtSize = (bytes: number): string => {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const fmtUsage = (bytes: number): string => {
    const gb = bytes / (1024 ** 3);
    return gb < 0.01 ? `${(bytes / (1024 ** 2)).toFixed(1)} MB` : `${gb.toFixed(2)} GB`;
};

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

// ─── File Icon ────────────────────────────────────────────────────────────────

function FileIcon({ item, size = 4 }: { item: DriveItem; size?: number }) {
    const cls = `h-${size} w-${size}`;
    if (item.type === 'folder') return <Folder className={`${cls} text-yellow-400`} />;
    const mime = item.mime_type ?? '';
    if (mime.startsWith('image/'))  return <FileImage className={`${cls} text-blue-400`} />;
    if (mime.startsWith('video/'))  return <FileVideo className={`${cls} text-purple-400`} />;
    if (mime.startsWith('audio/'))  return <FileAudio className={`${cls} text-pink-400`} />;
    if (mime.includes('pdf'))       return <FileText className={`${cls} text-red-400`} />;
    if (mime.includes('text') || ['md','txt','csv'].includes(item.extension ?? ''))
                                    return <FileText className={`${cls} text-green-400`} />;
    return <File className={`${cls} text-muted-foreground`} />;
}

// ─── Visibility Badge ─────────────────────────────────────────────────────────

function VisibilityBadge({ v, small = false }: { v: Visibility; small?: boolean }) {
    const base = small
        ? 'flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded'
        : 'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap';

    if (v === 'public') return (
        <span className={`${base} bg-green-500/15 text-green-600 dark:text-green-400`}>
            <Globe className={small ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            {!small && 'Public'}
        </span>
    );
    return (
        <span className={`${base} bg-muted/60 text-muted-foreground`}>
            <Lock className={small ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            {!small && 'Private'}
        </span>
    );
}

// ─── Storage Warning Banner ───────────────────────────────────────────────────

function StorageWarning({ pct }: { pct: number }) {
    if (pct < 80) return null;
    const critical = pct >= 95;
    return (
        <div className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm
            ${critical
                ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
                : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
                {critical
                    ? 'Storage is almost full. Delete files or ask an admin to increase your limit.'
                    : `You've used ${pct.toFixed(0)}% of your storage quota.`}
            </span>
        </div>
    );
}

// ─── Modal Shell + Header ─────────────────────────────────────────────────────

function ModalShell({ children, onClose, wide = false }: {
    children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`w-full rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-xl
                ${wide ? 'max-w-md' : 'max-w-sm'}`}>
                {children}
            </div>
        </div>
    );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
    return (
        <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameModal({ item, onClose }: { item: DriveItem; onClose: () => void }) {
    const [name, setName] = useState(item.name);
    const [saving, setSaving] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.select(); }, []);

    const submit = () => {
        if (!name.trim() || name === item.name) { onClose(); return; }
        setSaving(true);
        router.patch(`/drive/items/${item.id}/rename`, { name }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: () => setSaving(false),
        });
    };

    return (
        <ModalShell onClose={onClose}>
            <ModalHeader title="Rename" onClose={onClose} />
            <Input ref={ref} value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
                className="mb-4 text-sm" />
            <div className="flex gap-3">
                <Button onClick={submit} disabled={!name.trim() || saving} className="gap-2">
                    {saving ? 'Saving…' : <><Check className="h-4 w-4" />Rename</>}
                </Button>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
        </ModalShell>
    );
}

// ─── New Folder Modal ─────────────────────────────────────────────────────────

function NewFolderModal({ parentId, onClose }: { parentId: number | null; onClose: () => void }) {
    const [name, setName] = useState('Untitled folder');
    const [saving, setSaving] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.select(); }, []);

    const submit = () => {
        if (!name.trim()) return;
        setSaving(true);
        router.post('/drive/folders', { name, parent_id: parentId }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: () => setSaving(false),
        });
    };

    return (
        <ModalShell onClose={onClose}>
            <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                    <FolderPlus className="h-4 w-4 text-primary" />
                </div>
                <h3 className="font-semibold">New Folder</h3>
            </div>
            <Input ref={ref} value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
                className="mb-4 text-sm" />
            <div className="flex gap-3">
                <Button onClick={submit} disabled={!name.trim() || saving} className="gap-2">
                    {saving ? 'Creating…' : <><FolderPlus className="h-4 w-4" />Create</>}
                </Button>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
        </ModalShell>
    );
}

// ─── Move Modal ───────────────────────────────────────────────────────────────

function MoveModal({ item, allItems, onClose }: {
    item: DriveItem; allItems: DriveItem[]; onClose: () => void;
}) {
    const [targetId, setTargetId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const folders = allItems.filter(i => i.type === 'folder' && i.id !== item.id);

    const submit = () => {
        setSaving(true);
        router.patch(`/drive/items/${item.id}/move`, { parent_id: targetId }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: () => setSaving(false),
        });
    };

    return (
        <ModalShell onClose={onClose}>
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2"><Move className="h-4 w-4 text-primary" /></div>
                    <h3 className="font-semibold">Move "{item.name}"</h3>
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
            <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-sidebar-border/50 bg-muted/20">
                <button onClick={() => setTargetId(null)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-accent/50
                        ${targetId === null ? 'bg-primary/10 font-medium text-primary' : ''}`}>
                    <Home className="h-4 w-4" />My Drive (root)
                </button>
                {folders.map(f => (
                    <button key={f.id} onClick={() => setTargetId(f.id)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-accent/50
                            ${targetId === f.id ? 'bg-primary/10 font-medium text-primary' : ''}`}>
                        <Folder className="h-4 w-4 text-yellow-400" />{f.name}
                    </button>
                ))}
                {folders.length === 0 && (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">No other folders</p>
                )}
            </div>
            <div className="flex gap-3">
                <Button onClick={submit} disabled={saving} className="gap-2">
                    {saving ? 'Moving…' : <><Move className="h-4 w-4" />Move Here</>}
                </Button>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
        </ModalShell>
    );
}

// ─── Share & Visibility Modal ─────────────────────────────────────────────────

function ShareModal({ item, onClose }: { item: DriveItem; onClose: () => void }) {
    const [tab, setTab]               = useState<ShareTab>('link');

    // Visibility
    const [visibility, setVisibility] = useState<Visibility>(item.visibility);
    const [savingVis, setSavingVis]   = useState(false);

    // Link tab
    const [permission, setPermission] = useState<'view' | 'download'>('view');
    const [password, setPassword]     = useState('');
    const [showPw, setShowPw]         = useState(false);
    const [maxUses, setMaxUses]       = useState('');
    const [expiryDays, setExpiryDays] = useState('');
    const [createdUrl, setCreatedUrl] = useState<string | null>(null);
    const [copied, setCopied]         = useState(false);
    const [creatingLink, setCreatingLink] = useState(false);
    const [linkError, setLinkError]   = useState('');

    // Transfer tab
    const [recipientEmail, setRecipientEmail] = useState('');
    const [transferring, setTransferring]     = useState(false);
    const [transferDone, setTransferDone]     = useState(false);
    const [transferError, setTransferError]   = useState('');

    const handleVisibility = (v: Visibility) => {
        if (v === visibility || savingVis) return;
        setSavingVis(true);
        router.patch(`/drive/items/${item.id}/visibility`, { visibility: v }, {
            preserveScroll: true,
            onSuccess: () => { setVisibility(v); setSavingVis(false); },
            onError: () => setSavingVis(false),
        });
    };

    const handleCreateLink = () => {
        setLinkError('');
        setCreatingLink(true);
        router.post(`/drive/items/${item.id}/shares`, {
            permission,
            password: password || undefined,
            max_uses: maxUses ? parseInt(maxUses) : undefined,
            expires_in_days: expiryDays ? parseInt(expiryDays) : undefined,
        }, {
            preserveScroll: true,
            onSuccess: (page) => {
                setCreatingLink(false);
                const flash = (page.props as PageProps).flash;
                if (flash?.share_url) setCreatedUrl(flash.share_url);
            },
            onError: (errs) => {
                setCreatingLink(false);
                setLinkError(Object.values(errs).flat().join(' '));
            },
        });
    };

    const handleCopy = () => {
        if (!createdUrl) return;
        copyToClipboard(createdUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleTransfer = () => {
        if (!recipientEmail.trim()) return;
        setTransferError('');
        setTransferring(true);
        router.post(`/drive/items/${item.id}/transfer`, { recipient_email: recipientEmail }, {
            preserveScroll: true,
            onSuccess: () => { setTransferring(false); setTransferDone(true); },
            onError: (errs) => {
                setTransferring(false);
                setTransferError(Object.values(errs).flat().join(' '));
            },
        });
    };

    return (
        <ModalShell onClose={onClose} wide>
            {/* Header */}
            <div className="mb-5 flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 rounded-lg bg-primary/10 p-2">
                        <Share2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="truncate font-semibold leading-tight">{item.name}</h3>
                        <p className="text-xs capitalize text-muted-foreground">{item.type}</p>
                    </div>
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 shrink-0 p-0" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* ── Visibility ────────────────────────────────────────────── */}
            <div className="mb-5 rounded-xl border border-sidebar-border/50 bg-muted/20 p-4">
                <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Visibility
                </p>
                <div className="grid grid-cols-2 gap-2">
                    {([
                        {
                            value: 'private' as Visibility,
                            icon: <Lock className="h-4 w-4" />,
                            label: 'Private',
                            sub: 'Only you',
                            activeClass: 'border-primary bg-primary/10 text-primary',
                        },
                        {
                            value: 'public' as Visibility,
                            icon: <Globe className="h-4 w-4" />,
                            label: 'Public',
                            sub: 'Anyone with link',
                            activeClass: 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400',
                        },
                    ] as const).map(opt => (
                        <button key={opt.value}
                            disabled={savingVis}
                            onClick={() => handleVisibility(opt.value)}
                            className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition
                                ${visibility === opt.value
                                    ? opt.activeClass
                                    : 'border-sidebar-border/50 hover:bg-accent/40 text-foreground'}`}
                        >
                            {opt.icon}
                            <div className="text-left">
                                <p className="font-medium leading-none">{opt.label}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{opt.sub}</p>
                            </div>
                            {visibility === opt.value && (
                                <Check className="ml-auto h-3.5 w-3.5 shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tabs ──────────────────────────────────────────────────── */}
            <div className="mb-4 flex gap-1 rounded-lg border border-sidebar-border/50 bg-muted/20 p-1">
                {([
                    { key: 'link'     as ShareTab, icon: <Link className="h-3.5 w-3.5" />,  label: 'Share Link' },
                    { key: 'transfer' as ShareTab, icon: <Send className="h-3.5 w-3.5" />, label: 'Transfer'   },
                ]).map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition
                            ${tab === t.key
                                ? 'bg-card shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* ── Share Link Tab ────────────────────────────────────────── */}
            {tab === 'link' && (
                <div className="space-y-4">
                    {createdUrl ? (
                        /* ─ Created URL result ─ */
                        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                                <Check className="h-3.5 w-3.5" />Link created
                            </p>
                            <div className="flex gap-2">
                                <Input readOnly value={createdUrl}
                                    className="h-8 flex-1 bg-card font-mono text-xs" />
                                <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={handleCopy}>
                                    {copied
                                        ? <><Check className="h-3.5 w-3.5 text-green-500" />Copied</>
                                        : <><Copy className="h-3.5 w-3.5" />Copy</>}
                                </Button>
                            </div>
                            <button onClick={() => setCreatedUrl(null)}
                                className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:underline">
                                Create another link
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Permission */}
                            <div>
                                <Label className="mb-1.5 block text-xs font-medium">Permission</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        { v: 'view'     as const, icon: <Eye className="h-3.5 w-3.5" />,      label: 'View only'    },
                                        { v: 'download' as const, icon: <Download className="h-3.5 w-3.5" />, label: 'Can download' },
                                    ]).map(p => (
                                        <button key={p.v} onClick={() => setPermission(p.v)}
                                            className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm transition
                                                ${permission === p.v
                                                    ? 'border-primary bg-primary/10 font-medium text-primary'
                                                    : 'border-sidebar-border/50 hover:bg-accent/40'}`}>
                                            {p.icon}{p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Expiry + Max uses */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="mb-1 block text-xs font-medium">
                                        <Clock className="mr-1 inline h-3 w-3" />Expires (days)
                                    </Label>
                                    <Input value={expiryDays} onChange={e => setExpiryDays(e.target.value)}
                                        type="number" min="1" max="365" placeholder="Never"
                                        className="h-8 text-xs" />
                                </div>
                                <div>
                                    <Label className="mb-1 block text-xs font-medium">Max uses</Label>
                                    <Input value={maxUses} onChange={e => setMaxUses(e.target.value)}
                                        type="number" min="1" placeholder="Unlimited"
                                        className="h-8 text-xs" />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <Label className="mb-1 block text-xs font-medium">
                                    <Lock className="mr-1 inline h-3 w-3" />Password (optional)
                                </Label>
                                <div className="relative">
                                    <Input
                                        type={showPw ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Leave blank for no password"
                                        className="h-8 pr-8 text-xs"
                                    />
                                    <button onClick={() => setShowPw(v => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showPw
                                            ? <EyeOff className="h-3.5 w-3.5" />
                                            : <Eye className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {linkError && (
                                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                    {linkError}
                                </p>
                            )}

                            <Button onClick={handleCreateLink} disabled={creatingLink} className="w-full gap-2">
                                {creatingLink
                                    ? 'Generating…'
                                    : <><Link className="h-4 w-4" />Generate Share Link</>}
                            </Button>
                        </>
                    )}
                </div>
            )}

            {/* ── Transfer Tab ──────────────────────────────────────────── */}
            {tab === 'transfer' && (
                <div className="space-y-4">
                    {transferDone ? (
                        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 text-center">
                            <UserCheck className="mx-auto mb-2 h-8 w-8 text-green-500" />
                            <p className="font-medium">Transfer offer sent!</p>
                            <p className="text-xs text-muted-foreground">
                                The recipient will receive a notification to accept or decline.
                            </p>
                            <button
                                onClick={() => { setTransferDone(false); setRecipientEmail(''); }}
                                className="mt-2 text-xs text-primary underline-offset-2 hover:underline">
                                Send another
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-700 dark:text-yellow-400">
                                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                                Transferring permanently moves ownership to the recipient.
                            </div>
                            <div>
                                <Label className="mb-1.5 block text-xs font-medium">Recipient email</Label>
                                <Input
                                    type="email"
                                    value={recipientEmail}
                                    onChange={e => setRecipientEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    className="h-9 text-sm"
                                    onKeyDown={e => { if (e.key === 'Enter') handleTransfer(); }}
                                />
                            </div>
                            {transferError && (
                                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                    {transferError}
                                </p>
                            )}
                            <Button
                                onClick={handleTransfer}
                                disabled={!recipientEmail.trim() || transferring}
                                className="w-full gap-2">
                                {transferring
                                    ? 'Sending…'
                                    : <><Send className="h-4 w-4" />Send Transfer Offer</>}
                            </Button>
                        </>
                    )}
                </div>
            )}
        </ModalShell>
    );
}

// ─── Context Menu helpers ─────────────────────────────────────────────────────

function MenuItem({ icon, label, onClick, danger = false }: {
    icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
    return (
        <button onClick={onClick}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition
                ${danger ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-accent/50'}`}>
            {icon}{label}
        </button>
    );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuState { x: number; y: number; item: DriveItem }

function ContextMenu({ state, allItems, view, onClose, onRename, onMove, onShare }: {
    state: ContextMenuState;
    allItems: DriveItem[];
    view: ViewMode;
    onClose: () => void;
    onRename: (item: DriveItem) => void;
    onMove: (item: DriveItem) => void;
    onShare: (item: DriveItem) => void;
}) {
    const { item } = state;
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const action = (fn: () => void) => { fn(); onClose(); };

    if (view === 'trash') return (
        <div ref={ref} className="fixed z-50 min-w-[160px] rounded-lg border border-sidebar-border/70 bg-card py-1 shadow-xl"
            style={{ top: state.y, left: state.x }}>
            <MenuItem icon={<RotateCcw className="h-3.5 w-3.5 text-green-600" />} label="Restore"
                onClick={() => action(() => router.post(`/drive/items/${item.id}/restore`, {}, { preserveScroll: true }))} />
            <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete Forever" danger
                onClick={() => action(() => router.delete(`/drive/items/${item.id}/force`, { preserveScroll: true }))} />
        </div>
    );

    return (
        <div ref={ref} className="fixed z-50 min-w-[190px] rounded-lg border border-sidebar-border/70 bg-card py-1 shadow-xl"
            style={{ top: state.y, left: state.x }}>
            {item.type === 'folder' && (
                <MenuItem icon={<FolderOpen className="h-3.5 w-3.5 text-yellow-400" />} label="Open"
                    onClick={() => action(() => router.get(`/drive/folder/${item.id}`))} />
            )}
            {item.type === 'file' && (
                <MenuItem icon={<Download className="h-3.5 w-3.5 text-primary" />} label="Download"
                    onClick={() => action(() => window.open(`/drive/items/${item.id}/download`, '_blank'))} />
            )}
            <MenuItem icon={<Pencil className="h-3.5 w-3.5" />} label="Rename"
                onClick={() => action(() => onRename(item))} />
            <MenuItem icon={<Move className="h-3.5 w-3.5" />} label="Move to…"
                onClick={() => action(() => onMove(item))} />
            <MenuItem
                icon={<Star className={`h-3.5 w-3.5 ${item.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />}
                label={item.is_starred ? 'Unstar' : 'Star'}
                onClick={() => action(() => router.patch(`/drive/items/${item.id}/star`, {}, { preserveScroll: true }))} />
            <div className="my-1 border-t border-sidebar-border/50" />
            <MenuItem icon={<Share2 className="h-3.5 w-3.5 text-primary" />}
                label="Share & Visibility…"
                onClick={() => action(() => onShare(item))} />
            <div className="my-1 border-t border-sidebar-border/50" />
            <MenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Move to Trash" danger
                onClick={() => action(() => router.delete(`/drive/items/${item.id}`, { preserveScroll: true }))} />
        </div>
    );
}

// ─── Grid Item ────────────────────────────────────────────────────────────────

function GridItem({ item, view, onContextMenu, onDragStart, onDrop, onShare }: {
    item: DriveItem; view: ViewMode;
    onContextMenu: (e: React.MouseEvent, item: DriveItem) => void;
    onDragStart: (e: DragEvent, item: DriveItem) => void;
    onDrop: (e: DragEvent, targetId: number | null) => void;
    onShare: (item: DriveItem) => void;
}) {
    const [dragOver, setDragOver] = useState(false);
    const isFolder = item.type === 'folder';

    return (
        <div
            draggable={view !== 'trash'}
            onDragStart={e => onDragStart(e, item)}
            onDragOver={e => { if (isFolder) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { setDragOver(false); if (isFolder) onDrop(e, item.id); }}
            onContextMenu={e => { e.preventDefault(); onContextMenu(e, item); }}
            onClick={() => { if (view !== 'trash' && isFolder) router.get(`/drive/folder/${item.id}`); }}
            className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 transition select-none
                ${dragOver ? 'border-primary bg-primary/10' : 'border-sidebar-border/50 bg-muted/20 hover:bg-muted/40'}
                ${view === 'trash' ? 'opacity-70' : ''}`}
        >
            <div className="relative">
                <FileIcon item={item} size={10} />
                {item.is_starred && (
                    <Star className="absolute -top-1 -right-1 h-3 w-3 fill-yellow-400 text-yellow-400" />
                )}
            </div>
            <p className="w-full truncate text-center text-xs font-medium">{item.name}</p>
            <div className="flex items-center gap-1.5">
                {item.type === 'file' && (
                    <span className="text-[10px] text-muted-foreground">{fmtSize(item.size)}</span>
                )}
                <VisibilityBadge v={item.visibility} small />
            </div>

            {/* Hover quick actions */}
            {view !== 'trash' && (
                <div className="absolute top-1.5 right-1.5 hidden items-center gap-0.5 group-hover:flex">
                    <button className="rounded p-1 hover:bg-accent/80"
                        onClick={e => { e.stopPropagation(); onShare(item); }}
                        title="Share & visibility">
                        <Share2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button className="rounded p-1 hover:bg-accent/80"
                        onClick={e => { e.stopPropagation();
                            router.patch(`/drive/items/${item.id}/star`, {}, { preserveScroll: true }); }}>
                        <Star className={`h-3 w-3 ${item.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({ item, view, onContextMenu, onDragStart, onDrop, onShare }: {
    item: DriveItem; view: ViewMode;
    onContextMenu: (e: React.MouseEvent, item: DriveItem) => void;
    onDragStart: (e: DragEvent, item: DriveItem) => void;
    onDrop: (e: DragEvent, targetId: number | null) => void;
    onShare: (item: DriveItem) => void;
}) {
    const [dragOver, setDragOver] = useState(false);
    const isFolder = item.type === 'folder';

    return (
        <div
            draggable={view !== 'trash'}
            onDragStart={e => onDragStart(e, item)}
            onDragOver={e => { if (isFolder) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { setDragOver(false); if (isFolder) onDrop(e, item.id); }}
            onContextMenu={e => { e.preventDefault(); onContextMenu(e, item); }}
            onClick={() => { if (view !== 'trash' && isFolder) router.get(`/drive/folder/${item.id}`); }}
            className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition select-none
                ${dragOver ? 'border-primary bg-primary/10' : 'border-sidebar-border/50 bg-muted/20 hover:bg-muted/40'}`}
        >
            <FileIcon item={item} size={5} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {item.type === 'file' && item.extension && (
                    <p className="text-xs uppercase text-muted-foreground">{item.extension}</p>
                )}
            </div>

            {/* Visibility badge always visible */}
            <VisibilityBadge v={item.visibility} />

            <div className="hidden items-center gap-6 text-xs text-muted-foreground sm:flex">
                <span className="w-16 text-right">{item.type === 'file' ? fmtSize(item.size) : '—'}</span>
                <span className="w-28">{fmtDate(item.updated_at ?? item.created_at)}</span>
            </div>

            {item.is_starred && (
                <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
            )}

            {/* Row actions (visible on hover) */}
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                {view !== 'trash' && (
                    <button onClick={e => { e.stopPropagation(); onShare(item); }}
                        className="rounded p-1.5 hover:bg-accent/80" title="Share & visibility">
                        <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                )}
                <button
                    onClick={e => { e.stopPropagation();
                        view === 'trash'
                            ? router.post(`/drive/items/${item.id}/restore`, {}, { preserveScroll: true })
                            : router.delete(`/drive/items/${item.id}`, { preserveScroll: true });
                    }}
                    className="rounded p-1.5 hover:bg-destructive/10"
                >
                    {view === 'trash'
                        ? <RotateCcw className="h-3.5 w-3.5 text-green-600" />
                        : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                </button>
            </div>
        </div>
    );
}

// ─── Drop Zone Overlay ────────────────────────────────────────────────────────

function DropZoneOverlay({ visible }: { visible: boolean }) {
    if (!visible) return null;
    return (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card/80 px-12 py-8 shadow-2xl">
                <Upload className="h-10 w-10 text-primary" />
                <p className="text-lg font-semibold">Drop files to upload</p>
                <p className="text-sm text-muted-foreground">Files will be added to the current folder</p>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DriveIndex() {
    const {
        folder, items, breadcrumbs: crumbs,
        usage, storage_limit, view: viewProp,
    } = usePage<PageProps>().props;

// toast.success('Copied to clipboard!');

    const view          = (viewProp ?? 'my-drive') as ViewMode;
    const storageLimit  = storage_limit ?? DEFAULT_STORAGE_LIMIT;
    const currentFolderId = folder?.id ?? null;
    const usagePct      = Math.min((usage / storageLimit) * 100, 100);

    const [displayMode, setDisplayMode]   = useState<DisplayMode>('grid');
    const [search, setSearch]             = useState('');
    const [renameTarget, setRenameTarget] = useState<DriveItem | null>(null);
    const [newFolder, setNewFolder]       = useState(false);
    const [moveTarget, setMoveTarget]     = useState<DriveItem | null>(null);
    const [shareTarget, setShareTarget]   = useState<DriveItem | null>(null);
    const [contextMenu, setContextMenu]   = useState<ContextMenuState | null>(null);
    const [globalDragOver, setGlobalDragOver] = useState(false);
    const [draggedItem, setDraggedItem]   = useState<DriveItem | null>(null);
    const fileInputRef                    = useRef<HTMLInputElement>(null);
    const dragCounter                     = useRef(0);

    const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const folders  = filtered.filter(i => i.type === 'folder');
    const files    = filtered.filter(i => i.type === 'file');

    // ── Drag ──────────────────────────────────────────────────────────────

    const handleWindowDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
        if (view === 'trash' || view === 'starred') return;
        if (e.dataTransfer.types.includes('Files')) {
            dragCounter.current++;
            setGlobalDragOver(true);
        }
    }, [view]);

    const handleWindowDragLeave = useCallback(() => {
        dragCounter.current--;
        if (dragCounter.current <= 0) { dragCounter.current = 0; setGlobalDragOver(false); }
    }, []);

    const handleWindowDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounter.current = 0;
        setGlobalDragOver(false);
        if (!draggedItem && e.dataTransfer.files.length > 0)
            uploadFiles(e.dataTransfer.files, currentFolderId);
    }, [draggedItem, currentFolderId]);

    const handleItemDragStart = (e: DragEvent, item: DriveItem) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDropOnFolder = (e: DragEvent, targetFolderId: number | null) => {
        e.preventDefault();
        if (!draggedItem) return;
        if (draggedItem.id === targetFolderId) { setDraggedItem(null); return; }
        router.patch(`/drive/items/${draggedItem.id}/move`, { parent_id: targetFolderId }, {
            preserveScroll: true,
            onFinish: () => setDraggedItem(null),
        });
    };

    // ── Upload ─────────────────────────────────────────────────────────────

    const uploadFiles = (fileList: FileList, parentId: number | null) => {
        const formData = new FormData();
        Array.from(fileList).forEach(f => formData.append('files[]', f));
        if (parentId) formData.append('parent_id', String(parentId));
        router.post('/drive/upload', formData, { preserveScroll: true, forceFormData: true });
    };

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            uploadFiles(e.target.files, currentFolderId);
            e.target.value = '';
        }
    };

    // ── Breadcrumbs ────────────────────────────────────────────────────────

    const appBreadcrumbs: BreadcrumbItem[] = [
        { title: 'Drive', href: '/drive' },
        ...crumbs.map(c => ({ title: c.name, href: `/drive/folder/${c.id}` })),
        ...(folder ? [{ title: folder.name, href: `/drive/folder/${folder.id}` }] : []),
    ];

    // Shared item event props — keeps JSX below tight
    const itemEvents = (item: DriveItem) => ({
        item,
        view,
        onContextMenu: (e: React.MouseEvent, i: DriveItem) =>
            setContextMenu({ x: e.clientX, y: e.clientY, item: i }),
        onDragStart: handleItemDragStart,
        onDrop: handleDropOnFolder,
        onShare: (i: DriveItem) => setShareTarget(i),
    });

    return (
        <AppLayout breadcrumbs={appBreadcrumbs}>
            <Head title="Drive" />

            {renameTarget && <RenameModal item={renameTarget} onClose={() => setRenameTarget(null)} />}
            {newFolder    && <NewFolderModal parentId={currentFolderId} onClose={() => setNewFolder(false)} />}
            {moveTarget   && <MoveModal item={moveTarget} allItems={items} onClose={() => setMoveTarget(null)} />}
            {shareTarget  && <ShareModal item={shareTarget} onClose={() => setShareTarget(null)} />}
            {contextMenu  && (
                <ContextMenu
                    state={contextMenu} allItems={items} view={view}
                    onClose={() => setContextMenu(null)}
                    onRename={i => { setContextMenu(null); setRenameTarget(i); }}
                    onMove={i => { setContextMenu(null); setMoveTarget(i); }}
                    onShare={i => { setContextMenu(null); setShareTarget(i); }}
                />
            )}

            <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={handleFileInputChange} />

            <div className="flex h-full flex-1 flex-col"
                onDragEnter={handleWindowDragEnter}
                onDragLeave={handleWindowDragLeave}
                onDragOver={e => e.preventDefault()}
                onDrop={handleWindowDrop}>

                <DropZoneOverlay visible={globalDragOver && !draggedItem} />

                <div className="flex flex-1 gap-0 overflow-hidden">

                    {/* ── Sidebar ─────────────────────────────────────────── */}
                    <aside className="hidden w-56 flex-shrink-0 flex-col gap-1 border-r border-sidebar-border/50 bg-card p-4 lg:flex">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={usagePct >= 100}
                            className="mb-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-40"
                        >
                            <Upload className="h-4 w-4" />Upload
                        </button>

                        {[
                            { label: 'My Drive', icon: HardDrive, href: '/drive',         active: view === 'my-drive' },
                            { label: 'Starred',  icon: Star,      href: '/drive/starred', active: view === 'starred'  },
                            { label: 'Trash',    icon: Trash2,    href: '/drive/trash',   active: view === 'trash'    },
                        ].map(nav => (
                            <button key={nav.label} onClick={() => router.get(nav.href)}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition
                                    ${nav.active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent/50'}`}>
                                <nav.icon className="h-4 w-4" />{nav.label}
                            </button>
                        ))}

                        {/* ── Storage meter ──────────────────────────────── */}
                        <div className="mt-auto rounded-xl border border-sidebar-border/50 bg-muted/30 p-3">
                            <div className="mb-1.5 flex items-center justify-between">
                                <p className="text-xs font-medium">Storage</p>
                                <Shield className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                    className={`h-full rounded-full transition-all ${
                                        usagePct >= 95 ? 'bg-red-500' :
                                        usagePct >= 80 ? 'bg-yellow-500' : 'bg-primary'
                                    }`}
                                    style={{ width: `${usagePct.toFixed(1)}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {fmtUsage(usage)}
                                <span className="text-muted-foreground/60"> / {fmtUsage(storageLimit)}</span>
                            </p>
                        </div>
                    </aside>

                    {/* ── Main ────────────────────────────────────────────── */}
                    <main className="flex flex-1 flex-col overflow-auto p-6">

                        <StorageWarning pct={usagePct} />

                        {/* Top bar */}
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            {/* Breadcrumb */}
                            <div className="flex min-w-0 items-center gap-1 text-sm">
                                <button onClick={() => router.get('/drive')}
                                    className="flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground hover:text-foreground">
                                    <Home className="h-4 w-4" />
                                    <span className="hidden sm:inline">My Drive</span>
                                </button>
                                {crumbs.map(c => (
                                    <span key={c.id} className="flex items-center gap-1">
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        <button onClick={() => router.get(`/drive/folder/${c.id}`)}
                                            className="rounded px-1 py-0.5 text-muted-foreground hover:text-foreground">
                                            {c.name}
                                        </button>
                                    </span>
                                ))}
                                {folder && (
                                    <span className="flex items-center gap-1">
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="truncate font-medium">{folder.name}</span>
                                    </span>
                                )}
                                {view === 'starred' && <span className="font-medium">Starred</span>}
                                {view === 'trash'   && <span className="font-medium">Trash</span>}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder="Filter…" className="h-8 w-36 pl-7 text-xs sm:w-48" />
                                </div>
                                <div className="flex overflow-hidden rounded-lg border border-sidebar-border/50">
                                    <button onClick={() => setDisplayMode('grid')}
                                        className={`p-2 transition ${displayMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`}>
                                        <Grid3x3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => setDisplayMode('list')}
                                        className={`p-2 transition ${displayMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`}>
                                        <List className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                {view === 'my-drive' && (
                                    <>
                                        <Button size="sm" variant="outline" className="gap-1.5"
                                            onClick={() => setNewFolder(true)}>
                                            <FolderPlus className="h-4 w-4" />
                                            <span className="hidden sm:inline">New Folder</span>
                                        </Button>
                                        <Button size="sm" className="gap-1.5"
                                            disabled={usagePct >= 100}
                                            onClick={() => fileInputRef.current?.click()}>
                                            <Upload className="h-4 w-4" />
                                            <span className="hidden sm:inline">Upload</span>
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Empty drop zone */}
                        {view === 'my-drive' && items.length === 0 && (
                            <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-sidebar-border/50 text-center"
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files, currentFolderId);
                                }}>
                                <Upload className="h-12 w-12 text-muted-foreground/40" />
                                <div>
                                    <p className="font-medium">Drop files here or click Upload</p>
                                    <p className="text-sm text-muted-foreground">Supports any file type up to 100 MB</p>
                                </div>
                                <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                                    <Upload className="h-4 w-4" />Upload Files
                                </Button>
                            </div>
                        )}

                        {/* Folders */}
                        {folders.length > 0 && (
                            <div className="mb-6">
                                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Folders</p>
                                {displayMode === 'grid' ? (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                        {folders.map(item => <GridItem key={item.id} {...itemEvents(item)} />)}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {folders.map(item => <ListRow key={item.id} {...itemEvents(item)} />)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Files */}
                        {files.length > 0 && (
                            <div>
                                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {view === 'trash' ? 'Deleted Files' : 'Files'}
                                </p>
                                {displayMode === 'grid' ? (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                        {files.map(item => <GridItem key={item.id} {...itemEvents(item)} />)}
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-1 hidden grid-cols-[1fr_7rem_5rem_8rem_2rem] gap-3 px-4 text-xs font-medium text-muted-foreground sm:grid">
                                            <span>Name</span>
                                            <span>Visibility</span>
                                            <span className="text-right">Size</span>
                                            <span>Modified</span>
                                            <span />
                                        </div>
                                        <div className="space-y-1.5">
                                            {files.map(item => <ListRow key={item.id} {...itemEvents(item)} />)}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {view === 'trash' && items.length === 0 && (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                                <Trash2 className="h-12 w-12 text-muted-foreground/30" />
                                <p className="font-medium">Trash is empty</p>
                                <p className="text-sm text-muted-foreground">Deleted items will appear here</p>
                            </div>
                        )}
                        {view === 'starred' && items.length === 0 && (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                                <Star className="h-12 w-12 text-muted-foreground/30" />
                                <p className="font-medium">No starred items</p>
                                <p className="text-sm text-muted-foreground">Right-click any file or folder to star it</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </AppLayout>
    );
}
