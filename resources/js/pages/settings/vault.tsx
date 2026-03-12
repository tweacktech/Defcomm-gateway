import { Head, usePage, router } from '@inertiajs/react';
import {
    Copy,
    Check,
    Eye,
    EyeOff,
    RefreshCw,
    Shield,
    Clock,
    Lock,
    Plus,
    Pencil,
    Trash2,
    X,
    Save,
    ChevronRight,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface VaultItem {
    id: number;
    name: string;
    description?: string | null;
    value?: string; // only present in revealed_item
    created_at: string;
    updated_at: string;
}

type PageProps = {
    vault_items: VaultItem[];
    revealed_item?: VaultItem | null;
    auth: { user: unknown };
} & Record<string, unknown>;

type FormMode = 'create' | 'edit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({
    text,
    field,
    copiedField,
    onCopy,
}: {
    text: string;
    field: string;
    copiedField: string | null;
    onCopy: (t: string, f: string) => void;
}) {
    return (
        <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => onCopy(text, field)}
        >
            {copiedField === field ? (
                <>
                    <Check className="mr-1 h-3.5 w-3.5 text-green-600" />
                    Copied!
                </>
            ) : (
                <>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                </>
            )}
        </Button>
    );
}

// ─── Revealed Value Row ───────────────────────────────────────────────────────

function RevealedValueRow({
    item,
    copiedField,
    onCopy,
    onClose,
}: {
    item: VaultItem;
    copiedField: string | null;
    onCopy: (t: string, f: string) => void;
    onClose: () => void;
}) {
    const [show, setShow] = useState(false);

    return (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Revealed: {item.name}
                </span>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={onClose}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="relative">
                <Input
                    type={show ? 'text' : 'password'}
                    value={item.value ?? ''}
                    readOnly
                    className="bg-muted/50 pr-28 font-mono text-sm"
                />
                <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setShow((v) => !v)}
                    >
                        {show ? (
                            <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                            <Eye className="h-3.5 w-3.5" />
                        )}
                    </Button>
                    <CopyButton
                        text={item.value ?? ''}
                        field={`reveal-${item.id}`}
                        copiedField={copiedField}
                        onCopy={onCopy}
                    />
                </div>
            </div>
            <div className="mt-2 flex gap-6 text-xs text-muted-foreground">
                <span>Created: {fmtDate(item.created_at)}</span>
                <span>Updated: {fmtDate(item.updated_at)}</span>
            </div>
        </div>
    );
}

// ─── VaultRow ─────────────────────────────────────────────────────────────────

function VaultRow({
    item,
    isRevealed,
    onEdit,
    onDelete,
    onReveal,
}: {
    item: VaultItem;
    isRevealed: boolean;
    onEdit: (item: VaultItem) => void;
    onDelete: (id: number) => void;
    onReveal: (id: number) => void;
}) {
    return (
        <div
            className={`flex items-center justify-between rounded-lg border px-4 py-3 transition ${
                isRevealed
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-sidebar-border/50 bg-muted/20 hover:bg-muted/40'
            }`}
        >
            <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                    <Lock className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    {item.description && (
                        <p className="truncate text-xs text-muted-foreground">
                            {item.description}
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground/60">
                        {fmtDate(item.created_at)}
                    </p>
                </div>
            </div>
            <div className="ml-4 flex flex-shrink-0 items-center gap-1">
                <Button
                    size="sm"
                    variant={isRevealed ? 'secondary' : 'ghost'}
                    className="h-7 px-2 text-xs"
                    onClick={() => onReveal(item.id)}
                >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    {isRevealed ? 'Hide' : 'View'}
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => onEdit(item)}
                >
                    <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDelete(item.id)}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

// ─── VaultItemForm ────────────────────────────────────────────────────────────

function VaultItemForm({
    mode,
    initial,
    onSubmit,
    onCancel,
    isLoading,
}: {
    mode: FormMode;
    initial?: Partial<VaultItem>;
    onSubmit: (data: {
        name: string;
        value: string;
        description: string;
    }) => void;
    onCancel: () => void;
    isLoading: boolean;
}) {
    const [name, setName] = useState(initial?.name ?? '');
    const [value, setValue] = useState('');
    const [desc, setDesc] = useState(initial?.description ?? '');
    const [showVal, setShowVal] = useState(false);

    const dirty = name.trim() && (mode === 'create' ? value.trim() : true);

    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
            <div className="mb-5 flex items-center justify-between">
                <h3 className="font-semibold">
                    {mode === 'create' ? 'Add Vault Item' : 'Edit Vault Item'}
                </h3>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCancel}
                    className="h-7 w-7 p-0"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="vi-name" className="text-sm font-medium">
                        Name
                    </Label>
                    <Input
                        id="vi-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
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
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={
                                mode === 'edit'
                                    ? '••••••••'
                                    : 'Enter secret value'
                            }
                            className="pr-10 font-mono text-sm"
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
                            onClick={() => setShowVal((v) => !v)}
                            type="button"
                        >
                            {showVal ? (
                                <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                                <Eye className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="vi-desc" className="text-sm font-medium">
                        Description
                        <span className="ml-2 text-xs text-muted-foreground">
                            (optional)
                        </span>
                    </Label>
                    <Input
                        id="vi-desc"
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        placeholder="What is this secret for?"
                        className="text-sm"
                    />
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <Button
                        onClick={() =>
                            onSubmit({ name, value, description: desc })
                        }
                        disabled={!dirty || isLoading}
                        className="gap-2"
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                {mode === 'create'
                                    ? 'Add Item'
                                    : 'Save Changes'}
                            </>
                        )}
                    </Button>
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Vault() {
    const { vault_items = [], revealed_item } = usePage<PageProps>().props;

    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [formMode, setFormMode] = useState<FormMode | null>(null);
    const [editTarget, setEditTarget] = useState<VaultItem | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [items, setItems] = useState<VaultItem[]>(vault_items);

    const handleCopy = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Reveal: navigate to /vault/:id — controller re-renders page with revealed_item
    const handleReveal = (id: number) => {
        if (revealed_item?.id === id) {
            // Already revealed — navigate back to base to hide it
            router.get(
                '/vault',
                {},
                { preserveState: true, preserveScroll: true },
            );
            return;
        }
        router.get(
            `/vault/${id}`,
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    const handleCreate = (data: {
        name: string;
        value: string;
        description: string;
    }) => {
        setIsSaving(true);
        router.post('/vault', data, {
            preserveScroll: true,
            onSuccess: (page) => {
                setItems(
                    (page.props as unknown as PageProps).vault_items ?? items,
                );
                setFormMode(null);
                setIsSaving(false);
            },
            onError: () => setIsSaving(false),
        });
    };

    const handleUpdate = (data: {
        name: string;
        value: string;
        description: string;
    }) => {
        if (!editTarget) return;
        setIsSaving(true);
        const payload: Record<string, string> = {
            name: data.name,
            description: data.description,
        };
        if (data.value.trim()) payload.value = data.value;

        router.put(`/vault/${editTarget.id}`, payload, {
            preserveScroll: true,
            onSuccess: (page) => {
                setItems(
                    (page.props as unknown as PageProps).vault_items ?? items,
                );
                setFormMode(null);
                setEditTarget(null);
                setIsSaving(false);
            },
            onError: () => setIsSaving(false),
        });
    };

    const handleDelete = (id: number) => {
        router.delete(`/vault/${id}`, {
            preserveScroll: true,
            onSuccess: (page) => {
                setItems(
                    (page.props as unknown as PageProps).vault_items ??
                        items.filter((i) => i.id !== id),
                );
                setConfirmDelete(null);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Secret Vault" />

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
                            This will permanently delete the vault item. This
                            action cannot be undone.
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
                            <Button
                                variant="outline"
                                onClick={() => setConfirmDelete(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-8 p-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Secret Vault
                    </h1>
                    <p className="text-muted-foreground">
                        Encrypted key-value secrets — only you can view them
                    </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                    {/* ── Main column ── */}
                    <div className="space-y-6 lg:col-span-2">
                        <div className="rounded-xl border border-sidebar-border/70 bg-card">
                            <div className="border-b p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-primary/10 p-2.5">
                                            <Lock className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold">
                                                Vault Items
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                {items.length} stored secret
                                                {items.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => {
                                            setFormMode('create');
                                            setEditTarget(null);
                                        }}
                                        disabled={formMode === 'create'}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Item
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4 p-6">
                                {/* Revealed value banner */}
                                {revealed_item && (
                                    <RevealedValueRow
                                        item={revealed_item}
                                        copiedField={copiedField}
                                        onCopy={handleCopy}
                                        onClose={() =>
                                            router.get(
                                                '/vault',
                                                {},
                                                {
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                },
                                            )
                                        }
                                    />
                                )}

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
                                        onCancel={() => {
                                            setFormMode(null);
                                            setEditTarget(null);
                                        }}
                                        isLoading={isSaving}
                                    />
                                )}

                                {/* Item list */}
                                {items.length > 0 ? (
                                    <div className="space-y-2">
                                        {items.map((item) => (
                                            <VaultRow
                                                key={item.id}
                                                item={item}
                                                isRevealed={
                                                    revealed_item?.id ===
                                                    item.id
                                                }
                                                onEdit={(i) => {
                                                    setEditTarget(i);
                                                    setFormMode('edit');
                                                }}
                                                onDelete={(id) =>
                                                    setConfirmDelete(id)
                                                }
                                                onReveal={handleReveal}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    !formMode && (
                                        <div className="py-10 text-center">
                                            <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                                            <p className="text-sm font-medium">
                                                No vault items yet
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Click "Add Item" to store your
                                                first encrypted secret.
                                            </p>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Sidebar ── */}
                    <div className="space-y-4">
                        {/* Vault Overview */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-3 font-semibold">
                                Vault Overview
                            </h3>
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-primary/10 p-2.5">
                                    <Lock className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {items.length}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Stored secrets
                                    </p>
                                </div>
                            </div>
                            {items.length > 0 && (
                                <div className="mt-4 space-y-1 border-t pt-3">
                                    {items.slice(0, 5).map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-2 text-xs text-muted-foreground"
                                        >
                                            <ChevronRight className="h-3 w-3 flex-shrink-0" />
                                            <span className="truncate">
                                                {item.name}
                                            </span>
                                        </div>
                                    ))}
                                    {items.length > 5 && (
                                        <p className="pl-5 text-xs text-muted-foreground">
                                            +{items.length - 5} more
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Last activity */}
                        {items.length > 0 && (
                            <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                                <h3 className="mb-3 font-semibold">
                                    Last Modified
                                </h3>
                                <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">
                                        {fmtDate(items[0].updated_at)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Security tips */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-4 font-semibold">
                                Security Tips
                            </h3>
                            <ul className="space-y-3 text-sm">
                                {[
                                    'Secrets are AES-256 encrypted at rest',
                                    'Never share vault credentials',
                                    'Rotate secrets regularly',
                                    'Use descriptions to identify secrets',
                                ].map((tip) => (
                                    <li
                                        key={tip}
                                        className="flex items-start gap-2"
                                    >
                                        <Shield className="mt-0.5 h-4 w-4 text-green-600" />
                                        <span className="text-muted-foreground">
                                            {tip}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
