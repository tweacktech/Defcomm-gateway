import { Head, router, usePage } from '@inertiajs/react';
import {
    Package, Plus, Search, Pencil, Trash2, X, Check,
    ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
    AlertTriangle, RefreshCw, CheckCircle2, XCircle,
    KeyRound, MoreVertical,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiEndpoint {
    method: string;
    path: string;
    description?: string;
    auth?: string;
}

interface Service {
    id: number;
    key: string;
    name: string;
    description: string | null;
    web_path: string | null;
    api_base_path: string | null;
    api_endpoints: ApiEndpoint[];
    usage_notes: string | null;
    is_active: boolean;
    endpoint_count: number;
    created_at: string;
    created_ago: string;
    updated_ago: string;
}

interface Paginator<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Summary {
    total: number;
    active: number;
    inactive: number;
}

interface Filters {
    search: string;
    status: string;
}

interface PageProps extends Record<string, unknown> {
    services: Paginator<Service>;
    filters: Filters;
    summary: Summary;
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Services',  href: '/admin/services' },
];

// ─── Service Form ─────────────────────────────────────────────────────────────

interface FormState {
    key: string;
    name: string;
    description: string;
    web_path: string;
    api_base_path: string;
    usage_notes: string;
    is_active: boolean;
    api_endpoints: ApiEndpoint[];
}

interface ServiceFormProps {
    initial?: Partial<Service>;
    onSubmit: (data: FormState) => void;
    saving: boolean;
    errors: Record<string, string>;
    isEdit?: boolean;
}

function ServiceForm({ initial = {}, onSubmit, saving, errors, isEdit = false }: ServiceFormProps) {
    const [key, setKey]               = useState(initial.key ?? '');
    const [name, setName]             = useState(initial.name ?? '');
    const [description, setDesc]      = useState(initial.description ?? '');
    const [webPath, setWebPath]       = useState(initial.web_path ?? '');
    const [apiBase, setApiBase]       = useState(initial.api_base_path ?? '');
    const [usageNotes, setUsageNotes] = useState(initial.usage_notes ?? '');
    const [endpoints, setEndpoints]   = useState<ApiEndpoint[]>(initial.api_endpoints ?? []);
    const [isActive, setActive]       = useState(initial.is_active ?? true);
    const [keyTouched, setKeyTouched] = useState(isEdit);

    // Auto-derive key from name (create mode only)
    useEffect(() => {
        if (!keyTouched && !isEdit) {
            setKey(name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
        }
    }, [name, keyTouched, isEdit]);

    const handleSubmit = () => onSubmit({
        key, name, description, web_path: webPath, api_base_path: apiBase,
        usage_notes: usageNotes, is_active: isActive, api_endpoints: endpoints,
    });

    const addEndpoint = () => setEndpoints([...endpoints, { method: 'GET', path: '', description: '', auth: 'service' }]);
    const updateEndpoint = (i: number, field: keyof ApiEndpoint, value: string) => {
        const next = [...endpoints];
        next[i] = { ...next[i], [field]: value };
        setEndpoints(next);
    };
    const removeEndpoint = (i: number) => setEndpoints(endpoints.filter((_, idx) => idx !== i));

    return (
        <div className="space-y-4">

            {/* Name */}
            <div>
                <Label className="mb-1 block text-xs font-medium">
                    Name <span className="text-destructive">*</span>
                </Label>
                <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Web Development"
                    className="h-9 text-sm"
                />
                {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Key */}
            <div>
                <Label className="mb-1 block text-xs font-medium">
                    Key <span className="text-destructive">*</span>
                    <span className="ml-1 font-normal text-muted-foreground">(unique identifier, snake_case)</span>
                </Label>
                <div className="relative">
                    <KeyRound className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={key}
                        onChange={e => { setKeyTouched(true); setKey(e.target.value); }}
                        placeholder="web_development"
                        className="h-9 pl-7 font-mono text-sm"
                    />
                </div>
                {errors.key && <p className="mt-1 text-xs text-destructive">{errors.key}</p>}
            </div>

            {/* Description */}
            <div>
                <Label className="mb-1 block text-xs font-medium">Description</Label>
                <textarea
                    value={description}
                    onChange={e => setDesc(e.target.value)}
                    rows={4}
                    placeholder="Briefly describe what this service includes…"
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description}</p>}
            </div>

            {/* Web path */}
            <div>
                <Label className="mb-1 block text-xs font-medium">Web UI Path</Label>
                <Input value={webPath} onChange={e => setWebPath(e.target.value)} placeholder="/services/vault" className="h-9 text-sm" />
            </div>

            {/* API base path */}
            <div>
                <Label className="mb-1 block text-xs font-medium">API Base Path</Label>
                <Input value={apiBase} onChange={e => setApiBase(e.target.value)} placeholder="/api/client/vault" className="h-9 font-mono text-sm" />
            </div>

            {/* API endpoints */}
            <div>
                <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs font-medium">API Endpoints</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addEndpoint}>Add endpoint</Button>
                </div>
                <div className="space-y-2">
                    {endpoints.map((ep, i) => (
                        <div key={i} className="rounded-lg border p-3 space-y-2">
                            <div className="flex gap-2">
                                <select value={ep.method} onChange={e => updateEndpoint(i, 'method', e.target.value)}
                                    className="h-8 rounded-md border bg-background px-2 text-xs">
                                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                                </select>
                                <Input value={ep.path} onChange={e => updateEndpoint(i, 'path', e.target.value)}
                                    placeholder="/api/..." className="h-8 flex-1 font-mono text-xs" />
                                <Button type="button" size="sm" variant="ghost" onClick={() => removeEndpoint(i)}>×</Button>
                            </div>
                            <Input value={ep.description ?? ''} onChange={e => updateEndpoint(i, 'description', e.target.value)}
                                placeholder="Description" className="h-8 text-xs" />
                            <Input value={ep.auth ?? ''} onChange={e => updateEndpoint(i, 'auth', e.target.value)}
                                placeholder="Auth type (service, sanctum, secure-db-key)" className="h-8 text-xs" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Usage notes */}
            <div>
                <Label className="mb-1 block text-xs font-medium">API Usage Notes</Label>
                <textarea value={usageNotes} onChange={e => setUsageNotes(e.target.value)} rows={3}
                    placeholder="How to authenticate and use this service API…"
                    className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-xl border border-sidebar-border/50 bg-muted/20 px-4 py-3">
                <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-xs text-muted-foreground">Visible to clients on the platform</p>
                </div>
                <button
                    type="button"
                    onClick={() => setActive(v => !v)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                        ${isActive ? 'bg-primary' : 'bg-muted'}`}
                >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform
                        ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
            </div>

            <Button
                onClick={handleSubmit}
                disabled={!name.trim() || !key.trim() || saving}
                className="w-full gap-2"
            >
                {saving
                    ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving…</>
                    : <><Check className="h-4 w-4" />{isEdit ? 'Save Changes' : 'Create Service'}</>}
            </Button>
        </div>
    );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

interface DrawerProps {
    mode: 'create' | 'edit';
    service?: Service;
    onClose: () => void;
}

function Drawer({ mode, service, onClose }: DrawerProps) {
    const [saving, setSaving]     = useState(false);
    const [errors, setErrors]     = useState<Record<string, string>>({});
    const [confirmDel, setConfDel] = useState(false);

    const handleSubmit = (data: FormState) => {
        setSaving(true);
        setErrors({});

        if (mode === 'create') {
            router.post('/admin/services', data, {
                preserveScroll: true,
                onSuccess: () => { setSaving(false); onClose(); },
                onError: e => { setSaving(false); setErrors(e as Record<string, string>); },
            });
        } else {
            router.patch(`/admin/services/${service?.id}`, data, {
                preserveScroll: true,
                onSuccess: () => { setSaving(false); onClose(); },
                onError: e => { setSaving(false); setErrors(e as Record<string, string>); },
            });
        }
    };

    const handleDelete = () => {
        if (!service) return;
        router.delete(`/admin/services/${service.id}`, {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-sidebar-border/70 bg-card shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between border-b p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                            <Package className="h-4 w-4 text-primary" />
                        </div>
                        <h2 className="font-semibold">
                            {mode === 'create' ? 'New Service' : `Edit — ${service?.name}`}
                        </h2>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    <ServiceForm
                        initial={service}
                        onSubmit={handleSubmit}
                        saving={saving}
                        errors={errors}
                        isEdit={mode === 'edit'}
                    />

                    {/* Danger zone — edit only */}
                    {mode === 'edit' && service && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <p className="text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
                                    Danger Zone
                                </p>
                            </div>

                            {!confirmDel ? (
                                <button
                                    onClick={() => setConfDel(true)}
                                    className="flex w-full items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                                >
                                    <Trash2 className="h-4 w-4" />Delete this service
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                        This will permanently delete the service. This cannot be undone.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="destructive" onClick={handleDelete} className="gap-1.5">
                                            <Trash2 className="h-3.5 w-3.5" />Confirm Delete
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setConfDel(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Row menu ─────────────────────────────────────────────────────────────────

function RowMenu({ service, onEdit }: { service: Service; onEdit: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const act = (fn: () => void) => { setOpen(false); fn(); };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="rounded p-1.5 transition hover:bg-accent/60"
            >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>

            {open && (
                <div className="absolute right-0 z-20 mt-1 min-w-[170px] rounded-lg border border-sidebar-border/70 bg-card py-1 shadow-xl">
                    <button
                        onClick={() => act(onEdit)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50"
                    >
                        <Pencil className="h-3.5 w-3.5" />Edit service
                    </button>
                    <button
                        onClick={() => act(() => router.patch(`/admin/services/${service.id}/toggle`, {}, { preserveScroll: true }))}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50
                            ${service.is_active ? 'text-yellow-700 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}
                    >
                        {service.is_active
                            ? <ToggleLeft className="h-3.5 w-3.5" />
                            : <ToggleRight className="h-3.5 w-3.5" />}
                        {service.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <div className="my-1 border-t border-sidebar-border/50" />
                    <button
                        onClick={() => act(() => router.delete(`/admin/services/${service.id}`, { preserveScroll: true }))}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="h-3.5 w-3.5" />Delete
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServicesIndex() {
    const { services, filters, summary } = usePage<PageProps>().props;

    const [search, setSearch]   = useState(filters.search);
    const [drawer, setDrawer]   = useState<{ mode: 'create' | 'edit'; service?: Service } | null>(null);

    // Debounced search
    useEffect(() => {
        const t = setTimeout(() => {
            router.get('/admin/services', { ...filters, search }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const applyStatus = (status: string) => {
        router.get('/admin/services', { ...filters, status, page: 1 }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const summaryCards = [
        { label: 'Total',    value: summary.total,    color: 'text-foreground',                      bg: 'bg-muted/40'      },
        { label: 'Active',   value: summary.active,   color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-500/10'  },
        { label: 'Inactive', value: summary.inactive, color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Services" />

            {drawer && (
                <Drawer
                    mode={drawer.mode}
                    service={drawer.service}
                    onClose={() => setDrawer(null)}
                />
            )}

            <div className="flex flex-col gap-6 p-6">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
                        <p className="text-muted-foreground">
                            Manage the services available to your clients.
                        </p>
                    </div>
                    <Button className="gap-2" onClick={() => setDrawer({ mode: 'create' })}>
                        <Plus className="h-4 w-4" />New Service
                    </Button>
                </div>

                {/* ── Summary strip ───────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-3">
                    {summaryCards.map(({ label, value, color, bg }) => (
                        <div key={label}
                            className={`rounded-xl border border-sidebar-border/70 ${bg} px-5 py-4`}>
                            <p className={`text-3xl font-bold ${color}`}>{value}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                    ))}
                </div>

                {/* ── Table ──────────────────────────────────────────────── */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card">

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 border-b p-4">
                        <div className="relative flex-1 min-w-[180px]">
                            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name or key…"
                                className="h-8 pl-7 text-xs"
                            />
                        </div>

                        {/* Status filter tabs */}
                        <div className="flex overflow-hidden rounded-lg border border-sidebar-border/50">
                            {(['all', 'active', 'inactive'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => applyStatus(s)}
                                    className={`px-3 py-1.5 text-xs font-medium capitalize transition
                                        ${filters.status === s
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-accent/50'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        <span className="ml-auto text-xs text-muted-foreground">
                            {services.total} service{services.total !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    {['Service', 'Key', 'API', 'Status', 'Last updated', ''].map(h => (
                                        <th key={h} className="px-5 pb-3 pt-4 font-medium text-muted-foreground whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {services.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-5 py-14 text-center">
                                            <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                                            <p className="font-medium text-muted-foreground">No services found</p>
                                            <button
                                                onClick={() => setDrawer({ mode: 'create' })}
                                                className="mt-2 text-sm text-primary hover:underline"
                                            >
                                                Create your first service
                                            </button>
                                        </td>
                                    </tr>
                                ) : services.data.map(svc => (
                                    <tr key={svc.id}
                                        className="border-b last:border-0 transition hover:bg-muted/20">

                                        {/* Name + description */}
                                        <td className="px-5 py-3">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-2">
                                                    <Package className="h-3.5 w-3.5 text-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{svc.name}</p>
                                                    {svc.description && (
                                                        <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                                                            {svc.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Key */}
                                        <td className="px-5 py-3">
                                            <code className="rounded bg-muted/60 px-1.5 py-0.5 text-xs font-mono">
                                                {svc.key}
                                            </code>
                                        </td>

                                        {/* API info */}
                                        <td className="px-5 py-3">
                                            <div className="text-xs">
                                                {svc.api_base_path && (
                                                    <code className="block truncate max-w-[140px] text-muted-foreground">{svc.api_base_path}</code>
                                                )}
                                                <span className="text-muted-foreground">{svc.endpoint_count} endpoint{svc.endpoint_count !== 1 ? 's' : ''}</span>
                                                {svc.web_path && (
                                                    <a href={svc.web_path} className="block text-primary hover:underline">Web UI</a>
                                                )}
                                            </div>
                                        </td>

                                        {/* Status — click to toggle */}
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => router.patch(`/admin/services/${svc.id}/toggle`, {}, { preserveScroll: true })}
                                                title={svc.is_active ? 'Click to deactivate' : 'Click to activate'}
                                                className="group flex items-center gap-1.5"
                                            >
                                                {svc.is_active ? (
                                                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        <span className="text-xs font-medium">Active</span>
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-muted-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition">
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        <span className="text-xs font-medium">Inactive</span>
                                                    </span>
                                                )}
                                            </button>
                                        </td>

                                        {/* Updated */}
                                        <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                            {svc.updated_ago}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-5 py-3">
                                            <RowMenu
                                                service={svc}
                                                onEdit={() => setDrawer({ mode: 'edit', service: svc })}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {services.last_page > 1 && (
                        <div className="flex items-center justify-between border-t px-5 py-3">
                            <p className="text-xs text-muted-foreground">
                                {services.from != null && services.to != null
                                    ? `Showing ${services.from}–${services.to} of ${services.total}`
                                    : `${services.total} total`}
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    disabled={services.current_page === 1}
                                    onClick={() => router.get('/admin/services', { ...filters, page: services.current_page - 1 }, { preserveScroll: true })}
                                    className="rounded p-1.5 transition hover:bg-accent/50 disabled:opacity-30"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="px-2 text-xs text-muted-foreground">
                                    {services.current_page} / {services.last_page}
                                </span>
                                <button
                                    disabled={services.current_page === services.last_page}
                                    onClick={() => router.get('/admin/services', { ...filters, page: services.current_page + 1 }, { preserveScroll: true })}
                                    className="rounded p-1.5 transition hover:bg-accent/50 disabled:opacity-30"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
