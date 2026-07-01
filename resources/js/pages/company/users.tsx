import { Head, router, usePage } from '@inertiajs/react';
import {
    Users, Plus, Search, Pencil, X, Check, RefreshCw, ShieldCheck, UserCog,
    KeyRound, MoreVertical, CircleCheck, CircleOff, ShieldAlert, LogOut,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface OrgUser {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
    status: string;
    token_count: number;
    created_at: string;
}

interface Organization {
    id: number;
    name: string;
}

type PageProps = {
    organization: Organization;
    users: { data: OrgUser[]; total: number; current_page: number; last_page: number };
    filters: { search: string; status: string; role: string };
    summary: { total: number; active: number; company_admins: number; clients: number };
} & Record<string, unknown>;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Company Users', href: '/company/users' },
];

function CreateUserDrawer({ onClose, orgQuery }: { onClose: () => void; orgQuery: string }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [role, setRole] = useState<'company_admin' | 'client'>('client');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const submit = () => {
        setSaving(true);
        router.post(`/company/users${orgQuery}`, {
            name, email, password, password_confirmation: confirm, role,
        }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: e => { setSaving(false); setErrors(e as Record<string, string>); },
        });
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b p-6">
                    <h2 className="font-semibold">Add User</h2>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    <div><Label className="text-xs">Name *</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1 h-9" /></div>
                    <div><Label className="text-xs">Email *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 h-9" /></div>
                    <div><Label className="text-xs">Password *</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 h-9" /></div>
                    <div><Label className="text-xs">Confirm password *</Label><Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 h-9" /></div>
                    <div>
                        <Label className="text-xs">Role</Label>
                        <select value={role} onChange={e => setRole(e.target.value as 'company_admin' | 'client')} className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
                            <option value="client">User</option>
                            <option value="company_admin">Company Admin</option>
                        </select>
                    </div>
                    {Object.values(errors).map((e, i) => <p key={i} className="text-xs text-destructive">{e}</p>)}
                    <Button className="w-full gap-2" disabled={saving || !name || !email || !password} onClick={submit}>
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Create User
                    </Button>
                </div>
            </div>
        </>
    );
}

function RowMenu({ user, orgQuery }: { user: OrgUser; orgQuery: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const act = (fn: () => void) => { setOpen(false); fn(); };
    const base = `/company/users/${user.id}`;

    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(v => !v)} className="rounded p-1.5 hover:bg-accent/60"><MoreVertical className="h-4 w-4 text-muted-foreground" /></button>
            {open && (
                <div className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-lg border bg-card py-1 shadow-xl">
                    {user.role !== 'company_admin' && (
                        <button onClick={() => act(() => router.patch(`${base}/role${orgQuery}`, { role: 'company_admin' }, { preserveScroll: true }))}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50">
                            <ShieldCheck className="h-3.5 w-3.5" />Make Admin
                        </button>
                    )}
                    {user.role !== 'client' && (
                        <button onClick={() => act(() => router.patch(`${base}/role${orgQuery}`, { role: 'client' }, { preserveScroll: true }))}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50">
                            <UserCog className="h-3.5 w-3.5" />Make User
                        </button>
                    )}
                    {user.status !== 'active' && (
                        <button onClick={() => act(() => router.patch(`${base}/status${orgQuery}`, { status: 'active' }, { preserveScroll: true }))}
                            className="flex w-full gap-2 px-3 py-2 text-sm hover:bg-accent/50"><CircleCheck className="h-3.5 w-3.5" />Activate</button>
                    )}
                    {user.status !== 'inactive' && (
                        <button onClick={() => act(() => router.patch(`${base}/status${orgQuery}`, { status: 'inactive' }, { preserveScroll: true }))}
                            className="flex w-full gap-2 px-3 py-2 text-sm hover:bg-accent/50"><CircleOff className="h-3.5 w-3.5" />Deactivate</button>
                    )}
                    {user.status !== 'suspended' && (
                        <button onClick={() => act(() => router.patch(`${base}/status${orgQuery}`, { status: 'suspended' }, { preserveScroll: true }))}
                            className="flex w-full gap-2 px-3 py-2 text-sm text-red-600 hover:bg-accent/50"><ShieldAlert className="h-3.5 w-3.5" />Suspend</button>
                    )}
                    <button disabled={user.token_count === 0}
                        onClick={() => act(() => router.delete(`${base}/tokens${orgQuery}`, { preserveScroll: true }))}
                        className="flex w-full gap-2 px-3 py-2 text-sm hover:bg-accent/50 disabled:opacity-40">
                        <LogOut className="h-3.5 w-3.5" />Revoke tokens ({user.token_count})
                    </button>
                </div>
            )}
        </div>
    );
}

export default function CompanyUsers() {
    const { organization, users, filters, summary } = usePage<PageProps>().props;
    const [search, setSearch] = useState(filters.search);
    const [showCreate, setShowCreate] = useState(false);
    const orgQuery = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('organization_id')
        ? `?organization_id=${new URLSearchParams(window.location.search).get('organization_id')}`
        : '';

    useEffect(() => {
        const t = setTimeout(() => {
            router.get(`/company/users${orgQuery}`, { ...filters, search }, { preserveState: true, preserveScroll: true, replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${organization.name} — Users`} />
            {showCreate && <CreateUserDrawer onClose={() => setShowCreate(false)} orgQuery={orgQuery} />}

            <div className="flex flex-col gap-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">{organization.name}</h1>
                        <p className="text-muted-foreground">Manage users in your organization</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild><a href={`/company/credentials${orgQuery}`}><KeyRound className="mr-2 h-4 w-4" />Credentials</a></Button>
                        <Button className="gap-2" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />Add User</Button>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: 'Total', value: summary.total },
                        { label: 'Active', value: summary.active },
                        { label: 'Admins', value: summary.company_admins },
                        { label: 'Users', value: summary.clients },
                    ].map(c => (
                        <div key={c.label} className="rounded-xl border bg-muted/30 px-4 py-3">
                            <p className="text-2xl font-bold">{c.value}</p>
                            <p className="text-xs text-muted-foreground">{c.label}</p>
                        </div>
                    ))}
                </div>

                <div className="rounded-xl border bg-card">
                    <div className="flex flex-wrap items-center gap-3 border-b p-4">
                        <div className="relative min-w-[180px] flex-1">
                            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" className="h-8 pl-7 text-xs" />
                        </div>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left">
                                {['User', 'Role', 'Status', 'Tokens', ''].map(h => (
                                    <th key={h} className="px-5 py-3 font-medium text-muted-foreground">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {users.data.map(user => (
                                <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20">
                                    <td className="px-5 py-3">
                                        <p className="font-medium">{user.name}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </td>
                                    <td className="px-5 py-3">{user.role_label}</td>
                                    <td className="px-5 py-3 capitalize">{user.status}</td>
                                    <td className="px-5 py-3">{user.token_count}</td>
                                    <td className="px-5 py-3"><RowMenu user={user} orgQuery={orgQuery} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
