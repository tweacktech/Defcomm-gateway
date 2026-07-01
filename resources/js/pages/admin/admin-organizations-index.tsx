import { Head, router, usePage } from '@inertiajs/react';
import {
    Building2, Plus, Search, Pencil, Trash2, X, Check,
    ChevronLeft, ChevronRight, Users, KeyRound, AlertTriangle,
    RefreshCw, CheckCircle2, XCircle, MoreVertical, ArrowUpRight,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Organization {
    id: number;
    name: string;
    email: string | null;
    status: 'active' | 'inactive' | 'suspended';
    users_count: number;
    client_id: string | null;
    client_credentials_active: boolean;
    created_at: string;
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
    suspended: number;
    with_credentials: number;
}

type PageProps = {
    organizations: Paginator<Organization>;
    filters: { search: string; status: string };
    summary: Summary;
} & Record<string, unknown>;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Companies', href: '/admin/organizations' },
];

const STATUS_COLORS = {
    active: 'text-green-600 dark:text-green-400',
    inactive: 'text-muted-foreground',
    suspended: 'text-red-600 dark:text-red-400',
};

function OrgForm({ initial, onSubmit, saving, errors, onClose }: {
    initial?: Partial<Organization>;
    onSubmit: (data: Record<string, string>) => void;
    saving: boolean;
    errors: Record<string, string>;
    onClose: () => void;
}) {
    const [name, setName] = useState(initial?.name ?? '');
    const [email, setEmail] = useState(initial?.email ?? '');
    const [status, setStatus] = useState(initial?.status ?? 'active');

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b p-6">
                    <h2 className="font-semibold">{initial?.id ? 'Edit Company' : 'New Company'}</h2>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    <div>
                        <Label className="mb-1 block text-xs">Company name *</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} className="h-9" />
                        {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
                    </div>
                    <div>
                        <Label className="mb-1 block text-xs">Email</Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-9" />
                        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div>
                        <Label className="mb-1 block text-xs">Status</Label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value as Organization['status'])}
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </div>
                    <Button
                        className="w-full gap-2"
                        disabled={!name.trim() || saving}
                        onClick={() => onSubmit({ name, email, status })}
                    >
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {initial?.id ? 'Save Changes' : 'Create Company'}
                    </Button>
                </div>
            </div>
        </>
    );
}

export default function AdminOrganizationsIndex() {
    const { organizations, filters, summary } = usePage<PageProps>().props;
    const [search, setSearch] = useState(filters.search);
    const [drawer, setDrawer] = useState<{ mode: 'create' | 'edit'; org?: Organization } | null>(null);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        const t = setTimeout(() => {
            router.get('/admin/organizations', { ...filters, search }, { preserveState: true, preserveScroll: true, replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const submit = (data: Record<string, string>) => {
        setSaving(true);
        setErrors({});
        if (drawer?.mode === 'create') {
            router.post('/admin/organizations', data, {
                preserveScroll: true,
                onSuccess: () => { setSaving(false); setDrawer(null); },
                onError: e => { setSaving(false); setErrors(e as Record<string, string>); },
            });
        } else if (drawer?.org) {
            router.patch(`/admin/organizations/${drawer.org.id}`, data, {
                preserveScroll: true,
                onSuccess: () => { setSaving(false); setDrawer(null); },
                onError: e => { setSaving(false); setErrors(e as Record<string, string>); },
            });
        }
    };

    const summaryCards = [
        { label: 'Total', value: summary.total, bg: 'bg-muted/40' },
        { label: 'Active', value: summary.active, bg: 'bg-green-500/10' },
        { label: 'With API keys', value: summary.with_credentials, bg: 'bg-blue-500/10' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Companies" />
            {drawer && (
                <OrgForm
                    initial={drawer.org}
                    onSubmit={submit}
                    saving={saving}
                    errors={errors}
                    onClose={() => setDrawer(null)}
                />
            )}

            <div className="flex flex-col gap-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Company Management</h1>
                        <p className="text-muted-foreground">Manage organizations, credentials, and company users.</p>
                    </div>
                    <Button className="gap-2" onClick={() => setDrawer({ mode: 'create' })}>
                        <Plus className="h-4 w-4" />New Company
                    </Button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    {summaryCards.map(c => (
                        <div key={c.label} className={`rounded-xl border px-5 py-4 ${c.bg}`}>
                            <p className="text-3xl font-bold">{c.value}</p>
                            <p className="text-xs text-muted-foreground">{c.label}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-xl border bg-card">
                    <div className="flex flex-wrap items-center gap-3 border-b p-4">
                        <div className="relative min-w-[180px] flex-1">
                            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search companies…" className="h-8 pl-7 text-xs" />
                        </div>
                        <div className="flex overflow-hidden rounded-lg border">
                            {(['all', 'active', 'inactive', 'suspended'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => router.get('/admin/organizations', { ...filters, status: s }, { preserveScroll: true })}
                                    className={`px-3 py-1.5 text-xs capitalize ${filters.status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    {['Company', 'Users', 'API Credentials', 'Status', ''].map(h => (
                                        <th key={h} className="px-5 py-3 font-medium text-muted-foreground">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {organizations.data.map(org => (
                                    <tr key={org.id} className="border-b last:border-0 hover:bg-muted/20">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-primary/10 p-2"><Building2 className="h-4 w-4 text-primary" /></div>
                                                <div>
                                                    <p className="font-medium">{org.name}</p>
                                                    <p className="text-xs text-muted-foreground">{org.email ?? 'No email'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                <Users className="h-3.5 w-3.5" />{org.users_count}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            {org.client_credentials_active ? (
                                                <span className="flex items-center gap-1 text-green-600"><KeyRound className="h-3.5 w-3.5" />Active</span>
                                            ) : (
                                                <span className="text-muted-foreground">Not configured</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 capitalize">
                                            <span className={STATUS_COLORS[org.status]}>{org.status}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-1">
                                                <Button size="sm" variant="ghost" asChild>
                                                    <a href={`/admin/organizations/${org.id}`} className="gap-1">
                                                        View <ArrowUpRight className="h-3.5 w-3.5" />
                                                    </a>
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setDrawer({ mode: 'edit', org })}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive"
                                                    onClick={() => confirm('Delete this company?') && router.delete(`/admin/organizations/${org.id}`, { preserveScroll: true })}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
