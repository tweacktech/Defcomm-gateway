import { Head, usePage, router } from '@inertiajs/react';
import {
    Copy, Check, Eye, EyeOff, RefreshCw, Key, Shield,
    Clock, AlertCircle, Download, Plus, Pencil, Trash2,
    Lock, X, Save, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { edit } from '@/routes/profile';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Profile settings', href: edit().url },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiClient {
    id: number;
    user_id: number;
    client_id: string;
    client_secret: string;
    access_token?: string | null;
    name?: string;
    created_at: string;
    updated_at: string;
    expires_at?: string;
}

interface VaultItem {
    id: number;
    name: string;
    description?: string | null;
    value?: string; // only present after a "reveal" fetch
    created_at: string;
    updated_at: string;
}

type PageProps = {
    client: ApiClient | null;
    access_token?: string | null;
    vault_items?: VaultItem[];
    auth: { user: unknown };
} & Record<string, unknown>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const maskString = (str: string, visibleChars = 8) => {
    if (!str) return '';
    const first = str.slice(0, visibleChars);
    const last  = str.slice(-4);
    const dots  = Math.min(str.length - (visibleChars + 4), 20);
    return `${first}${'•'.repeat(dots)}${last}`;
};

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });

// ─── Sub-components ──────────────────────────────────────────────────────────

function CopyButton({
    text, field, copiedField, onCopy,
}: { text: string; field: string; copiedField: string | null; onCopy: (t: string, f: string) => void }) {
    const copied = copiedField === field;
    return (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onCopy(text, field)}>
            {copied ? (
                <><Check className="mr-1 h-3.5 w-3.5 text-green-600" />Copied!</>
            ) : (
                <><Copy className="mr-1 h-3.5 w-3.5" />Copy</>
            )}
        </Button>
    );
}

// ─── Vault Item Row ──────────────────────────────────────────────────────────

function VaultRow({
    item,
    onEdit,
    onDelete,
    onReveal,
}: {
    item: VaultItem;
    onEdit: (item: VaultItem) => void;
    onDelete: (id: number) => void;
    onReveal: (id: number) => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-sidebar-border/50 bg-muted/20 px-4 py-3 transition hover:bg-muted/40">
            <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                    <Lock className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    {item.description && (
                        <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground/60">{fmtDate(item.created_at)}</p>
                </div>
            </div>
            <div className="ml-4 flex flex-shrink-0 items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onReveal(item.id)}>
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    View
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                    size="sm" variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

// ─── Vault Item Form ─────────────────────────────────────────────────────────

type FormMode = 'create' | 'edit';

function VaultItemForm({
    mode,
    initial,
    onSubmit,
    onCancel,
    isLoading,
}: {
    mode: FormMode;
    initial?: Partial<VaultItem>;
    onSubmit: (data: { name: string; value: string; description: string }) => void;
    onCancel: () => void;
    isLoading: boolean;
}) {
    const [name, setName]        = useState(initial?.name ?? '');
    const [value, setValue]       = useState('');
    const [desc, setDesc]         = useState(initial?.description ?? '');
    const [showVal, setShowVal]   = useState(false);

    const dirty = name.trim() && (mode === 'create' ? value.trim() : true);

    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
            <div className="mb-5 flex items-center justify-between">
                <h3 className="font-semibold">
                    {mode === 'create' ? 'Add Vault Item' : 'Edit Vault Item'}
                </h3>
                <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 w-7 p-0">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="vi-name" className="text-sm font-medium">Name</Label>
                    <Input
                        id="vi-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Database password"
                        className="text-sm"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="vi-value" className="text-sm font-medium">
                        Secret Value
                        {mode === 'edit' && (
                            <span className="ml-2 text-xs text-muted-foreground">
                                (leave blank to keep existing)
                            </span>
                        )}
                    </Label>
                    <div className="relative">
                        <Input
                            id="vi-value"
                            type={showVal ? 'text' : 'password'}
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            placeholder={mode === 'edit' ? '••••••••' : 'Enter secret value'}
                            className="pr-10 font-mono text-sm"
                        />
                        <Button
                            size="sm" variant="ghost"
                            className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
                            onClick={() => setShowVal(v => !v)}
                            type="button"
                        >
                            {showVal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="vi-desc" className="text-sm font-medium">
                        Description
                        <span className="ml-2 text-xs text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                        id="vi-desc"
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        placeholder="What is this secret for?"
                        className="text-sm"
                    />
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <Button
                        onClick={() => onSubmit({ name, value, description: desc })}
                        disabled={!dirty || isLoading}
                        className="gap-2"
                    >
                        {isLoading
                            ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving...</>
                            : <><Save className="h-4 w-4" />{mode === 'create' ? 'Add Item' : 'Save Changes'}</>
                        }
                    </Button>
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Reveal Modal ────────────────────────────────────────────────────────────

function RevealModal({
    item,
    onClose,
    copiedField,
    onCopy,
}: {
    item: VaultItem;
    onClose: () => void;
    copiedField: string | null;
    onCopy: (text: string, field: string) => void;
}) {
    const [show, setShow] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                            <Lock className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">{item.name}</h3>
                            {item.description && (
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                        </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Secret Value
                    </Label>
                    <div className="relative">
                        <Input
                            type={show ? 'text' : 'password'}
                            value={item.value ?? ''}
                            readOnly
                            className="bg-muted/50 pr-24 font-mono text-sm"
                        />
                        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShow(v => !v)}>
                                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            <CopyButton
                                text={item.value ?? ''}
                                field={`reveal-${item.id}`}
                                copiedField={copiedField}
                                onCopy={onCopy}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 text-xs text-muted-foreground">
                    <span>Created: {fmtDate(item.created_at)}</span>
                    <span>Updated: {fmtDate(item.updated_at)}</span>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Vault() {
    const { client, access_token, vault_items = [] } = usePage<PageProps>().props;

    // --- Credentials state
    const [copiedField, setCopiedField]         = useState<string | null>(null);
    const [showAccessToken, setShowAccessToken] = useState(false);
    const [showSecret, setShowSecret]           = useState(false);
    const [isGenerating, setIsGenerating]       = useState(false);
    const [credentials, setCredentials]         = useState<ApiClient | null>(client);
    const [accessToken, setAccessToken]         = useState<string | null>(
        access_token ?? client?.access_token ?? null,
    );

    // --- Vault items state
    const [items, setItems]             = useState<VaultItem[]>(vault_items);
    const [formMode, setFormMode]       = useState<FormMode | null>(null);
    const [editTarget, setEditTarget]   = useState<VaultItem | null>(null);
    const [revealItem, setRevealItem]   = useState<VaultItem | null>(null);
    const [isSaving, setIsSaving]       = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    // --- Copy helper
    const handleCopy = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // --- Generate credentials
    const handleGenerate = () => {
        setIsGenerating(true);
        router.post('/generate-access-token', {}, {
            onSuccess: (page) => {
                const props = page.props as unknown as PageProps;
                setCredentials(props.client);
                setAccessToken(props.access_token ?? props.client?.access_token ?? null);
                setIsGenerating(false);
            },
            onError: () => setIsGenerating(false),
        });
    };

    // --- Vault CRUD
    const handleReveal = (id: number) => {
        router.get(
            `/api/client/vault/${id}`,
            {},
            {
                preserveState: true,
                onSuccess: (page) => {
                    const props = page.props as unknown as { vault_item: VaultItem };
                    setRevealItem(props.vault_item);
                },
            },
        );
    };

    const handleCreate = (data: { name: string; value: string; description: string }) => {
        setIsSaving(true);
        router.post('/api/client/vault', data, {
            preserveState: true,
            onSuccess: (page) => {
                const props = page.props as unknown as PageProps;
                setItems(props.vault_items ?? items);
                setFormMode(null);
                setIsSaving(false);
            },
            onError: () => setIsSaving(false),
        });
    };

    const handleUpdate = (data: { name: string; value: string; description: string }) => {
        if (!editTarget) return;
        setIsSaving(true);

        const payload: Record<string, string> = {
            name: data.name,
            description: data.description,
        };
        if (data.value.trim()) payload.value = data.value;

        router.put(`/api/client/vault/${editTarget.id}`, payload, {
            preserveState: true,
            onSuccess: (page) => {
                const props = page.props as unknown as PageProps;
                setItems(props.vault_items ?? items);
                setFormMode(null);
                setEditTarget(null);
                setIsSaving(false);
            },
            onError: () => setIsSaving(false),
        });
    };

    const handleDelete = (id: number) => {
        router.delete(`/api/client/vault/${id}`, {
            preserveState: true,
            onSuccess: (page) => {
                const props = page.props as unknown as PageProps;
                setItems(props.vault_items ?? items.filter(i => i.id !== id));
                setConfirmDelete(null);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="API Credentials & Vault" />

            {/* Reveal modal */}
            {revealItem && (
                <RevealModal
                    item={revealItem}
                    onClose={() => setRevealItem(null)}
                    copiedField={copiedField}
                    onCopy={handleCopy}
                />
            )}

            {/* Delete confirm modal */}
            {confirmDelete !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-xl">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-lg bg-destructive/10 p-2">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </div>
                            <h3 className="font-semibold">Delete Vault Item</h3>
                        </div>
                        <p className="mb-5 text-sm text-muted-foreground">
                            This will permanently delete the vault item. This action cannot be undone.
                        </p>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="destructive"
                                className="gap-2"
                                onClick={() => handleDelete(confirmDelete)}
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </Button>
                            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-8 p-6">
                {/* Page header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">API Credentials & Vault</h1>
                    <p className="text-muted-foreground">
                        Manage client credentials and store encrypted secrets
                    </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                    {/* ── Left column ── */}
                    <div className="space-y-6 lg:col-span-2">

                        {/* ── Client Credentials card ── */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card">
                            <div className="border-b p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-primary/10 p-2.5">
                                            <Key className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold">Client Credentials</h2>
                                            <p className="text-sm text-muted-foreground">
                                                Authenticate your API requests
                                            </p>
                                        </div>
                                    </div>
                                    {credentials && (
                                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                                            Active
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6 p-6">
                                {credentials ? (
                                    <>
                                        {/* Access Token */}
                                        <div className="space-y-2">
                                            <Label htmlFor="access_token" className="text-sm font-medium">
                                                Access Token
                                                <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                                                    (Use as Bearer token)
                                                </span>
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="access_token"
                                                    type={showAccessToken ? 'text' : 'password'}
                                                    value={accessToken
                                                        ? showAccessToken ? accessToken : maskString(accessToken)
                                                        : ''}
                                                    readOnly
                                                    placeholder={!accessToken ? 'Generate credentials to obtain a token' : undefined}
                                                    className="bg-muted/50 pr-36 font-mono text-sm"
                                                />
                                                <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-1">
                                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={!accessToken} onClick={() => setShowAccessToken(v => !v)}>
                                                        {showAccessToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                    </Button>
                                                    {accessToken && (
                                                        <CopyButton text={accessToken} field="access_token" copiedField={copiedField} onCopy={handleCopy} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Client ID */}
                                        <div className="space-y-2">
                                            <Label htmlFor="client_id" className="text-sm font-medium">Client ID</Label>
                                            <div className="relative">
                                                <Input
                                                    id="client_id"
                                                    value={credentials.client_id}
                                                    readOnly
                                                    className="bg-muted/50 pr-24 font-mono text-sm"
                                                />
                                                <div className="absolute top-1/2 right-1 -translate-y-1/2">
                                                    <CopyButton text={credentials.client_id} field="client_id" copiedField={copiedField} onCopy={handleCopy} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Client Secret */}
                                        <div className="space-y-2">
                                            <Label htmlFor="client_secret" className="text-sm font-medium">
                                                Client Secret
                                                <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                                                    (Keep this secure!)
                                                </span>
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="client_secret"
                                                    type={showSecret ? 'text' : 'password'}
                                                    value={showSecret ? credentials.client_secret : maskString(credentials.client_secret)}
                                                    readOnly
                                                    className="bg-muted/50 pr-36 font-mono text-sm"
                                                />
                                                <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-1">
                                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowSecret(v => !v)}>
                                                        {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                    </Button>
                                                    <CopyButton text={credentials.client_secret} field="client_secret" copiedField={copiedField} onCopy={handleCopy} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Metadata */}
                                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-muted-foreground">Created:</span>
                                                <span className="font-medium">{fmtDate(credentials.created_at)}</span>
                                            </div>
                                            {credentials.expires_at && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-muted-foreground">Expires:</span>
                                                    <span className="font-medium">{fmtDate(credentials.expires_at)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-12 text-center">
                                        <Key className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                                        <h3 className="mb-2 text-lg font-medium">No credentials found</h3>
                                        <p className="mb-6 text-sm text-muted-foreground">
                                            Generate your first set of credentials to get started.
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-3 border-t pt-4">
                                    <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                                        {isGenerating
                                            ? <><RefreshCw className="h-4 w-4 animate-spin" />Generating...</>
                                            : <><RefreshCw className="h-4 w-4" />{credentials ? 'Regenerate' : 'Generate Credentials'}</>
                                        }
                                    </Button>
                                    {credentials && (
                                        <Button variant="outline" className="gap-2">
                                            <Download className="h-4 w-4" />
                                            Download
                                        </Button>
                                    )}
                                </div>

                                {credentials && (
                                    <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/50">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                                            <div className="text-sm text-yellow-800 dark:text-yellow-300">
                                                <p className="font-medium">Important:</p>
                                                <p>Regenerating will immediately invalidate existing credentials. Update all applications using the old credentials.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Vault Items card ── */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card">
                            <div className="border-b p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-primary/10 p-2.5">
                                            <Lock className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold">Secret Vault</h2>
                                            <p className="text-sm text-muted-foreground">
                                                Encrypted key-value secrets — only you can view them
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => { setFormMode('create'); setEditTarget(null); }}
                                        disabled={formMode === 'create'}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Item
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4 p-6">
                                {/* Inline create form */}
                                {formMode === 'create' && (
                                    <VaultItemForm
                                        mode="create"
                                        onSubmit={handleCreate}
                                        onCancel={() => setFormMode(null)}
                                        isLoading={isSaving}
                                    />
                                )}

                                {/* Inline edit form */}
                                {formMode === 'edit' && editTarget && (
                                    <VaultItemForm
                                        mode="edit"
                                        initial={editTarget}
                                        onSubmit={handleUpdate}
                                        onCancel={() => { setFormMode(null); setEditTarget(null); }}
                                        isLoading={isSaving}
                                    />
                                )}

                                {/* Item list */}
                                {items.length > 0 ? (
                                    <div className="space-y-2">
                                        {items.map(item => (
                                            <VaultRow
                                                key={item.id}
                                                item={item}
                                                onEdit={i => { setEditTarget(i); setFormMode('edit'); }}
                                                onDelete={id => setConfirmDelete(id)}
                                                onReveal={handleReveal}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    !formMode && (
                                        <div className="py-10 text-center">
                                            <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                                            <p className="text-sm font-medium">No vault items yet</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Click "Add Item" to store your first encrypted secret.
                                            </p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Sidebar ── */}
                    <div className="space-y-4">
                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-4 font-semibold">Using Your Credentials</h3>
                            <div className="space-y-4 text-sm">
                                <p className="text-muted-foreground">
                                    Include your access token in the Authorization header:
                                </p>
                                <div className="rounded-lg bg-muted p-3 font-mono text-xs">
                                    Authorization: Bearer {'{access_token}'}
                                </div>
                                <p className="font-medium">Example Request:</p>
                                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
{`curl -X GET https://api.example.com/v1/users \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "X-Client-ID: YOUR_CLIENT_ID"`}
                                </pre>
                            </div>
                        </div>

                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-4 font-semibold">Security Tips</h3>
                            <ul className="space-y-3 text-sm">
                                {[
                                    'Never share your client secret publicly',
                                    'Rotate credentials regularly',
                                    'Use environment variables for storage',
                                    'Vault secrets are AES-256 encrypted at rest',
                                ].map(tip => (
                                    <li key={tip} className="flex items-start gap-2">
                                        <Shield className="mt-0.5 h-4 w-4 text-green-600" />
                                        <span className="text-muted-foreground">{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-3 font-semibold">Vault Overview</h3>
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-primary/10 p-2.5">
                                    <Lock className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{items.length}</p>
                                    <p className="text-xs text-muted-foreground">Stored secrets</p>
                                </div>
                            </div>
                            {items.length > 0 && (
                                <div className="mt-4 space-y-1 border-t pt-3">
                                    {items.slice(0, 4).map(item => (
                                        <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <ChevronRight className="h-3 w-3 flex-shrink-0" />
                                            <span className="truncate">{item.name}</span>
                                        </div>
                                    ))}
                                    {items.length > 4 && (
                                        <p className="pl-5 text-xs text-muted-foreground">
                                            +{items.length - 4} more
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}