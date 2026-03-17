import { Head, router, usePage } from '@inertiajs/react';
import {
    Users, Search, ShieldCheck, UserCheck, UserX,
    KeyRound, Trash2, Pencil, X, Check, ChevronLeft,
    ChevronRight, Eye, EyeOff, AlertTriangle, MoreVertical,
    LogOut, UserPlus, RefreshCw,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    is_active: boolean;
    token_count: number;
    created_at: string;
    created_ago: string;
    last_seen_at: string | null;
    last_seen_ago: string;
}

interface Paginator<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface UserSummary {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    new_this_week: number;
}

interface PageProps extends Record<string, unknown> {
    users: Paginator<User>;
    search: string;
    summary: UserSummary;
    auth: { user: { id: number } };
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Users',     href: '/admin/users' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
    return active ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            <UserCheck className="h-3 w-3" />Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500 dark:text-red-400">
            <UserX className="h-3 w-3" />Inactive
        </span>
    );
}

function RoleBadge({ admin }: { admin: boolean }) {
    return admin ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <ShieldCheck className="h-3 w-3" />Admin
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            User
        </span>
    );
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────

interface EditDrawerProps {
    user: User;
    currentUserId: number;
    onClose: () => void;
}

function EditDrawer({ user, currentUserId, onClose }: EditDrawerProps) {
    const [name, setName]             = useState(user.name);
    const [email, setEmail]           = useState(user.email);
    const [password, setPassword]     = useState('');
    const [confirm, setConfirm]       = useState('');
    const [isAdmin, setIsAdmin]       = useState(user.is_admin);
    const [showPw, setShowPw]         = useState(false);
    const [saving, setSaving]         = useState(false);
    const [errors, setErrors]         = useState<Record<string, string>>({});
    const [confirmDelete, setConfirmDelete] = useState(false);
    const isSelf = user.id === currentUserId;

    const handleUpdate = () => {
        setSaving(true);
        setErrors({});
        router.patch(`/admin/users/${user.id}`, {
            name, email, is_admin: isAdmin,
            password: password || undefined,
            password_confirmation: confirm || undefined,
        }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: (e) => { setSaving(false); setErrors(e as Record<string, string>); },
        });
    };

    const handleToggleStatus = () => {
        router.patch(`/admin/users/${user.id}/status`, {}, {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    const handleRevokeAll = () => {
        router.delete(`/admin/users/${user.id}/tokens`, {
            preserveScroll: true,
        });
    };

    const handleDelete = () => {
        router.delete(`/admin/users/${user.id}`, {
            onSuccess: onClose,
        });
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={onClose} />

            {/* Drawer */}
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-sidebar-border/70 bg-card shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between border-b p-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                            {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-semibold leading-tight">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Status + role badges */}
                    <div className="flex items-center gap-2">
                        <StatusBadge active={user.is_active} />
                        <RoleBadge admin={user.is_admin} />
                        {user.token_count > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                                <KeyRound className="h-3 w-3" />{user.token_count} token{user.token_count !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {/* ── Edit form ───────────────────────────────────────── */}
                    <div className="rounded-xl border border-sidebar-border/50 bg-muted/20 p-5 space-y-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Account Info
                        </p>

                        <div>
                            <Label className="mb-1 block text-xs font-medium">Name</Label>
                            <Input value={name} onChange={e => setName(e.target.value)}
                                className="h-9 text-sm" />
                            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
                        </div>

                        <div>
                            <Label className="mb-1 block text-xs font-medium">Email</Label>
                            <Input value={email} onChange={e => setEmail(e.target.value)}
                                type="email" className="h-9 text-sm" />
                            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
                        </div>

                        <div>
                            <Label className="mb-1 block text-xs font-medium">
                                New password <span className="text-muted-foreground">(leave blank to keep current)</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-9 pr-8 text-sm"
                                />
                                <button onClick={() => setShowPw(v => !v)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                            {password && (
                                <Input value={confirm} onChange={e => setConfirm(e.target.value)}
                                    type="password" placeholder="Confirm password"
                                    className="mt-2 h-9 text-sm" />
                            )}
                            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
                        </div>

                        {/* Admin toggle */}
                        {!isSelf && (
                            <div className="flex items-center justify-between rounded-lg border border-sidebar-border/50 px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    <div>
                                        <p className="text-sm font-medium">Admin role</p>
                                        <p className="text-xs text-muted-foreground">Full platform access</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAdmin(v => !v)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                                        ${isAdmin ? 'bg-primary' : 'bg-muted'}`}
                                >
                                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform
                                        ${isAdmin ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        )}

                        <Button onClick={handleUpdate} disabled={saving} className="w-full gap-2">
                            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving…</> : <><Check className="h-4 w-4" />Save Changes</>}
                        </Button>
                    </div>

                    {/* ── Account controls ───────────────────────────────── */}
                    {!isSelf && (
                        <div className="rounded-xl border border-sidebar-border/50 bg-muted/20 p-5 space-y-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Account Controls
                            </p>

                            {/* Activate / Deactivate */}
                            <button
                                onClick={handleToggleStatus}
                                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-sm transition
                                    ${user.is_active
                                        ? 'border-red-500/30 bg-red-500/5 text-red-600 hover:bg-red-500/10 dark:text-red-400'
                                        : 'border-green-500/30 bg-green-500/5 text-green-600 hover:bg-green-500/10 dark:text-green-400'}`}
                            >
                                {user.is_active
                                    ? <><UserX className="h-4 w-4" /><span>Deactivate account</span><span className="ml-auto text-xs opacity-70">Blocks login</span></>
                                    : <><UserCheck className="h-4 w-4" /><span>Activate account</span><span className="ml-auto text-xs opacity-70">Restores access</span></>}
                            </button>

                            {/* Revoke all tokens */}
                            <button
                                onClick={handleRevokeAll}
                                disabled={user.token_count === 0}
                                className="flex w-full items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-700 transition hover:bg-yellow-500/10 dark:text-yellow-400 disabled:opacity-40"
                            >
                                <LogOut className="h-4 w-4" />
                                <span>Revoke all tokens</span>
                                <span className="ml-auto text-xs opacity-70">
                                    {user.token_count} active
                                </span>
                            </button>
                        </div>
                    )}

                    {/* ── Danger zone ────────────────────────────────────── */}
                    {!isSelf && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <p className="text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
                                    Danger Zone
                                </p>
                            </div>
                            {!confirmDelete ? (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    className="flex w-full items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
                                >
                                    <Trash2 className="h-4 w-4" />Delete user account
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                        This will permanently delete the account and all tokens. Type <strong>DELETE</strong> to confirm.
                                    </p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="destructive" onClick={handleDelete} className="gap-1.5">
                                            <Trash2 className="h-3.5 w-3.5" />Confirm Delete
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Meta */}
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Joined: {user.created_ago}</p>
                        <p>Last seen: {user.last_seen_ago}</p>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── Row actions (3-dot menu) ─────────────────────────────────────────────────

function RowMenu({ user, currentUserId, onEdit }: {
    user: User; currentUserId: number; onEdit: () => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const isSelf = user.id === currentUserId;

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(v => !v)}
                className="rounded p-1.5 hover:bg-accent/60 transition">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            {open && (
                <div className="absolute right-0 z-20 mt-1 min-w-[170px] rounded-lg border border-sidebar-border/70 bg-card py-1 shadow-xl">
                    <button onClick={() => { setOpen(false); onEdit(); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50">
                        <Pencil className="h-3.5 w-3.5" />Edit user
                    </button>
                    {!isSelf && (
                        <>
                            <button onClick={() => { setOpen(false); router.patch(`/admin/users/${user.id}/status`, {}, { preserveScroll: true }); }}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 ${user.is_active ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {user.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                                {user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                                disabled={user.token_count === 0}
                                onClick={() => { setOpen(false); router.delete(`/admin/users/${user.id}/tokens`, { preserveScroll: true }); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-yellow-700 hover:bg-accent/50 dark:text-yellow-400 disabled:opacity-40">
                                <LogOut className="h-3.5 w-3.5" />Revoke tokens ({user.token_count})
                            </button>
                            <div className="my-1 border-t border-sidebar-border/50" />
                            <button onClick={() => { setOpen(false); router.delete(`/admin/users/${user.id}`); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" />Delete user
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersIndex() {
    const { users, search: initialSearch, summary, auth } = usePage<PageProps>().props;

    const [search, setSearch]         = useState(initialSearch);
    const [editUser, setEditUser]     = useState<User | null>(null);

    const handleSearch = (value: string) => {
        setSearch(value);
        router.get('/admin/users', { search: value }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const summaryCards = [
        { label: 'Total',        value: summary.total,         color: 'text-foreground',                          bg: 'bg-muted/40'      },
        { label: 'Active',       value: summary.active,        color: 'text-green-600 dark:text-green-400',       bg: 'bg-green-500/10'  },
        { label: 'Inactive',     value: summary.inactive,      color: 'text-red-500 dark:text-red-400',           bg: 'bg-red-500/10'    },
        { label: 'Admins',       value: summary.admins,        color: 'text-primary',                             bg: 'bg-primary/10'    },
        { label: 'New this week',value: summary.new_this_week, color: 'text-blue-600 dark:text-blue-400',         bg: 'bg-blue-500/10'   },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Management" />

            {/* Edit Drawer */}
            {editUser && (
                <EditDrawer
                    user={editUser}
                    currentUserId={auth.user.id}
                    onClose={() => setEditUser(null)}
                />
            )}

            <div className="flex flex-col gap-6 p-6">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
                        <p className="text-muted-foreground">
                            Manage accounts, roles, and access tokens.
                        </p>
                    </div>
                    <Button className="gap-2" onClick={() => router.get('/admin/users/create')}>
                        <UserPlus className="h-4 w-4" />Invite User
                    </Button>
                </div>

                {/* ── Summary strip ───────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {summaryCards.map(({ label, value, color, bg }) => (
                        <div key={label}
                            className={`rounded-xl border border-sidebar-border/70 ${bg} px-4 py-3`}>
                            <p className={`text-2xl font-bold ${color}`}>{value}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                    ))}
                </div>

                {/* ── Table ──────────────────────────────────────────────── */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card">

                    {/* Toolbar */}
                    <div className="flex items-center justify-between border-b p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-primary/10 p-2">
                                <Users className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm font-medium">
                                {users.total} user{users.total !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="relative w-56">
                            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={e => handleSearch(e.target.value)}
                                placeholder="Search name or email…"
                                className="h-8 pl-7 text-xs"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    {['User', 'Role', 'Status', 'Tokens', 'Last seen', 'Joined', ''].map(h => (
                                        <th key={h} className="px-5 pb-3 pt-4 font-medium text-muted-foreground">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                                            No users found.
                                        </td>
                                    </tr>
                                ) : users.data.map(user => (
                                    <tr key={user.id}
                                        className="border-b last:border-0 transition hover:bg-muted/20">
                                        {/* User */}
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                    {user.name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium">{user.name}</p>
                                                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Role */}
                                        <td className="px-5 py-3"><RoleBadge admin={user.is_admin} /></td>
                                        {/* Status */}
                                        <td className="px-5 py-3"><StatusBadge active={user.is_active} /></td>
                                        {/* Tokens */}
                                        <td className="px-5 py-3">
                                            {user.token_count > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                                    <KeyRound className="h-3 w-3" />{user.token_count}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        {/* Last seen */}
                                        <td className="px-5 py-3 text-xs text-muted-foreground">{user.last_seen_ago}</td>
                                        {/* Joined */}
                                        <td className="px-5 py-3 text-xs text-muted-foreground">{user.created_ago}</td>
                                        {/* Actions */}
                                        <td className="px-5 py-3">
                                            <RowMenu
                                                user={user}
                                                currentUserId={auth.user.id}
                                                onEdit={() => setEditUser(user)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {users.last_page > 1 && (
                        <div className="flex items-center justify-between border-t px-5 py-3">
                            <p className="text-xs text-muted-foreground">
                                Showing {users.from}–{users.to} of {users.total}
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    disabled={users.current_page === 1}
                                    onClick={() => router.get(`/admin/users?page=${users.current_page - 1}&search=${search}`, {}, { preserveScroll: true })}
                                    className="rounded p-1.5 transition hover:bg-accent/50 disabled:opacity-30">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="px-2 text-xs text-muted-foreground">
                                    {users.current_page} / {users.last_page}
                                </span>
                                <button
                                    disabled={users.current_page === users.last_page}
                                    onClick={() => router.get(`/admin/users?page=${users.current_page + 1}&search=${search}`, {}, { preserveScroll: true })}
                                    className="rounded p-1.5 transition hover:bg-accent/50 disabled:opacity-30">
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
