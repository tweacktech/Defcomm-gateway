import { Head, router, usePage } from '@inertiajs/react';
import {
    Users, Search, KeyRound, Trash2, Pencil, X, Check,
    ChevronLeft, ChevronRight, Eye, EyeOff, AlertTriangle,
    RefreshCw, LogOut, UserPlus, MoreVertical,
    ShieldCheck, ShieldAlert, CircleOff, CircleCheck, UserCog,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole   = 'super' | 'admin' | 'user';
type UserStatus = 'pending' | 'active' | 'block';

interface User {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    role_label?: string;
    platform_role?: string | null;
    status: UserStatus;
    token_count: number;
    created_ago: string;
    last_seen_ago: string;
}

interface Paginator<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface UserSummary {
    total: number;
    active: number;
    pending: number;
    block: number;
    supers: number;
    admins: number;
    users: number;
    new_this_week: number;
}

interface PageProps extends Record<string, unknown> {
    users: Paginator<User>;
    search: string;
    status: string;
    role: string;
    summary: UserSummary;
    organizations: { id: number; name: string }[];
    can_invite_super: boolean;
    auth: { user: { id: number } };
    errors?: Record<string, string>;
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Users',     href: '/admin/users' },
];

const PLATFORM_SUB_ROLES: { value: string; label: string; access: string }[] = [
    { value: 'general_admin', label: 'General Admin', access: 'Full platform access' },
    { value: 'billing', label: 'Billing', access: 'Dashboard, companies, plans, users' },
    { value: 'support', label: 'Support', access: 'Dashboard, support, notifications, languages, agreements, mail' },
    { value: 'developer', label: 'Developer', access: 'Dashboard, services, Secure DB, store, bounty' },
];

function InviteUserDrawer({
    organizations,
    canInviteSuper,
    onClose,
}: {
    organizations: { id: number; name: string }[];
    canInviteSuper: boolean;
    onClose: () => void;
}) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>(canInviteSuper ? 'super' : 'user');
    const [platformRole, setPlatformRole] = useState('general_admin');
    const [organizationId, setOrganizationId] = useState(organizations[0]?.id?.toString() ?? '');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const selectedSubRole = PLATFORM_SUB_ROLES.find((r) => r.value === platformRole);

    const submit = () => {
        setSaving(true);
        setErrors({});
        router.post('/admin/users/invite', {
            name: name || undefined,
            email,
            role,
            platform_role: role === 'super' ? platformRole : undefined,
            organization_id: role === 'super' ? undefined : Number(organizationId),
        }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: (e) => { setSaving(false); setErrors(e as Record<string, string>); },
        });
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b p-6">
                    <h2 className="font-semibold">Invite User</h2>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    <p className="text-sm text-muted-foreground">
                        Send an email invitation so they can set up their account.
                    </p>
                    <div>
                        <Label className="text-xs">Name</Label>
                        <Input className="mt-1 h-9" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs">Email *</Label>
                        <Input type="email" className="mt-1 h-9" value={email} onChange={(e) => setEmail(e.target.value)} />
                        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div>
                        <Label className="text-xs">Role *</Label>
                        <select
                            className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                            value={role}
                            onChange={(e) => setRole(e.target.value as UserRole)}
                        >
                            {canInviteSuper && <option value="super">Super</option>}
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                        </select>
                        {errors.role && <p className="mt-1 text-xs text-destructive">{errors.role}</p>}
                    </div>
                    {role === 'super' ? (
                        <div>
                            <Label className="text-xs">Sub-role *</Label>
                            <select
                                className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                                value={platformRole}
                                onChange={(e) => setPlatformRole(e.target.value)}
                            >
                                {PLATFORM_SUB_ROLES.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                            {selectedSubRole && (
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                    Access: {selectedSubRole.access}
                                </p>
                            )}
                            {errors.platform_role && <p className="mt-1 text-xs text-destructive">{errors.platform_role}</p>}
                        </div>
                    ) : (
                        <div>
                            <Label className="text-xs">Organization *</Label>
                            <select
                                className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                                value={organizationId}
                                onChange={(e) => setOrganizationId(e.target.value)}
                            >
                                {organizations.length === 0 && <option value="">No organizations</option>}
                                {organizations.map((o) => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                            {errors.organization_id && <p className="mt-1 text-xs text-destructive">{errors.organization_id}</p>}
                        </div>
                    )}
                    <Button
                        className="w-full gap-2"
                        disabled={saving || !email || (role !== 'super' && !organizationId)}
                        onClick={submit}
                    >
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Send Invitation
                    </Button>
                </div>
            </div>
        </>
    );
}
// ─── Badges ───────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<UserStatus, string> = {
    pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    active: 'bg-green-500/10 text-green-600 dark:text-green-400',
    block: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

function StatusBadge({ status }: { status: UserStatus }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_MAP[status]}`}>
            {status}
        </span>
    );
}

function RoleBadge({ role, platformRole }: { role: UserRole; platformRole?: string | null }) {
    if (role === 'super') {
        const sub = PLATFORM_SUB_ROLES.find((r) => r.value === platformRole)?.label ?? 'Super';
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <ShieldCheck className="h-3 w-3" />{sub}
            </span>
        );
    }
    if (role === 'admin') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                <ShieldCheck className="h-3 w-3" />Admin
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <UserCog className="h-3 w-3" />User
        </span>
    );
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────

function EditDrawer({ user, currentUserId, onClose }: {
    user: User; currentUserId: number; onClose: () => void;
}) {
    const [name, setName]         = useState(user.name);
    const [email, setEmail]       = useState(user.email);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm]   = useState('');
    const [showPw, setShowPw]     = useState(false);
    const [saving, setSaving]     = useState(false);
    const [errors, setErrors]     = useState<Record<string, string>>({});
    const [confirmDel, setConfDel]= useState(false);
    const isSelf = user.id === currentUserId;

    const handleUpdate = () => {
        setSaving(true);
        setErrors({});
        router.patch(`/admin/users/${user.id}`, {
            name, email,
            password: password || undefined,
            password_confirmation: confirm || undefined,
        }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: e => { setSaving(false); setErrors(e as Record<string, string>); },
        });
    };

    const handleDelete = () => {
        router.delete(`/admin/users/${user.id}`, { onSuccess: onClose });
    };

    // ── Status options ───────────────────────────────────────────────────────
    const statusOptions: { value: UserStatus; icon: React.ReactNode; label: string; sub: string; activeColor: string }[] = [
        { value: 'active', icon: <CircleCheck className="h-4 w-4" />, label: 'Active', sub: 'Full access', activeColor: 'border-green-500 bg-green-500/10 text-green-600 dark:text-green-400' },
        { value: 'pending', icon: <CircleOff className="h-4 w-4" />, label: 'Pending', sub: 'Awaiting approval', activeColor: 'border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
        { value: 'block', icon: <ShieldAlert className="h-4 w-4" />, label: 'Block', sub: 'Access blocked', activeColor: 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400' },
    ];

    // ── Role options ─────────────────────────────────────────────────────────
    const roleOptions: { value: UserRole; icon: React.ReactNode; label: string; sub: string; activeColor: string }[] = [
        { value: 'super', icon: <ShieldCheck className="h-4 w-4" />, label: 'Super', sub: 'Full platform access', activeColor: 'border-primary bg-primary/10 text-primary' },
        { value: 'admin', icon: <ShieldCheck className="h-4 w-4" />, label: 'Admin', sub: 'Manage organization', activeColor: 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' },
        { value: 'user', icon: <UserCog className="h-4 w-4" />, label: 'User', sub: 'Standard access', activeColor: 'border-sidebar-border/70 bg-muted/30 text-foreground' },
    ];

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
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

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* Current badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={user.status} />
                        <RoleBadge role={user.role} platformRole={user.platform_role} />
                        {user.token_count > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                                <KeyRound className="h-3 w-3" />{user.token_count} token{user.token_count !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {/* ── Status picker ───────────────────────────────────── */}
                    <div className="rounded-xl border border-sidebar-border/50 bg-muted/20 p-4 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Account Status
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            {statusOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    disabled={isSelf}
                                    onClick={() => router.patch(
                                        `/admin/users/${user.id}/status`,
                                        { status: opt.value },
                                        { preserveScroll: true }
                                    )}
                                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center text-xs transition
                                        ${user.status === opt.value ? opt.activeColor : 'border-sidebar-border/50 hover:bg-accent/40'}
                                        disabled:cursor-not-allowed disabled:opacity-40`}
                                >
                                    {opt.icon}
                                    <span className="font-semibold">{opt.label}</span>
                                    <span className="text-muted-foreground leading-tight">{opt.sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Role picker ─────────────────────────────────────── */}
                    <div className="rounded-xl border border-sidebar-border/50 bg-muted/20 p-4 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Role
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {roleOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    disabled={isSelf}
                                    onClick={() => router.patch(
                                        `/admin/users/${user.id}/role`,
                                        {
                                            role: opt.value,
                                            platform_role: opt.value === 'super'
                                                ? (user.platform_role || 'general_admin')
                                                : undefined,
                                        },
                                        { preserveScroll: true }
                                    )}
                                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center text-xs transition
                                        ${user.role === opt.value ? opt.activeColor : 'border-sidebar-border/50 hover:bg-accent/40'}
                                        disabled:cursor-not-allowed disabled:opacity-40`}
                                >
                                    {opt.icon}
                                    <span className="font-semibold">{opt.label}</span>
                                    <span className="text-muted-foreground">{opt.sub}</span>
                                </button>
                            ))}
                        </div>
                        {user.role === 'super' && !isSelf && (
                            <div className="pt-2 space-y-2">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Sub-role
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {PLATFORM_SUB_ROLES.map((sub) => (
                                        <button
                                            key={sub.value}
                                            onClick={() => router.patch(
                                                `/admin/users/${user.id}/role`,
                                                { role: 'super', platform_role: sub.value },
                                                { preserveScroll: true }
                                            )}
                                            className={`rounded-lg border p-2.5 text-left text-xs transition
                                                ${(user.platform_role || 'general_admin') === sub.value
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-sidebar-border/50 hover:bg-accent/40'}`}
                                        >
                                            <span className="font-semibold block">{sub.label}</span>
                                            <span className="text-muted-foreground leading-tight">{sub.access}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {isSelf && (
                            <p className="text-xs text-muted-foreground">You cannot change your own role or status.</p>
                        )}
                    </div>

                    {/* ── Edit form ────────────────────────────────────────── */}
                    <div className="rounded-xl border border-sidebar-border/50 bg-muted/20 p-5 space-y-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Account Info
                        </p>
                        <div>
                            <Label className="mb-1 block text-xs font-medium">Name</Label>
                            <Input value={name} onChange={e => setName(e.target.value)} className="h-9 text-sm" />
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
                                New password{' '}
                                <span className="font-normal text-muted-foreground">(leave blank to keep)</span>
                            </Label>
                            <div className="relative">
                                <Input type={showPw ? 'text' : 'password'}
                                    value={password} onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••" className="h-9 pr-8 text-sm" />
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
                        <Button onClick={handleUpdate} disabled={saving} className="w-full gap-2">
                            {saving
                                ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving…</>
                                : <><Check className="h-4 w-4" />Save Changes</>}
                        </Button>
                    </div>

                    {/* ── Token revoke ─────────────────────────────────────── */}
                    {!isSelf && (
                        <button onClick={() => router.delete(`/admin/users/${user.id}/tokens`, { preserveScroll: true })}
                            disabled={user.token_count === 0}
                            className="flex w-full items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-700 transition hover:bg-yellow-500/10 dark:text-yellow-400 disabled:opacity-40">
                            <LogOut className="h-4 w-4" />
                            <span>Revoke all tokens</span>
                            <span className="ml-auto text-xs opacity-70">{user.token_count} active</span>
                        </button>
                    )}

                    {/* ── Danger zone ───────────────────────────────────────── */}
                    {!isSelf && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 space-y-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                <p className="text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
                                    Danger Zone
                                </p>
                            </div>
                            {!confirmDel ? (
                                <button onClick={() => setConfDel(true)}
                                    className="flex w-full items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-500/10 dark:text-red-400">
                                    <Trash2 className="h-4 w-4" />Delete user account
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                        Permanently deletes the account and all tokens.
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

                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Joined: {user.created_ago}</p>
                        <p>Last seen: {user.last_seen_ago}</p>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── Row menu ─────────────────────────────────────────────────────────────────

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

    const act = (fn: () => void) => { setOpen(false); fn(); };
    const setStatus = (status: UserStatus) =>
        router.patch(`/admin/users/${user.id}/status`, { status }, { preserveScroll: true });
    const setRole = (role: UserRole) =>
        router.patch(`/admin/users/${user.id}/role`, { role }, { preserveScroll: true });

    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(v => !v)}
                className="rounded p-1.5 transition hover:bg-accent/60">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            {open && (
                <div className="absolute right-0 z-20 mt-1 min-w-[190px] rounded-lg border border-sidebar-border/70 bg-card py-1 shadow-xl">
                    <button onClick={() => act(onEdit)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50">
                        <Pencil className="h-3.5 w-3.5" />Edit user
                    </button>

                    {!isSelf && (
                        <>
                            {/* Status options — show only non-current */}
                            <div className="my-1 border-t border-sidebar-border/50" />
                            {user.status !== 'active' && (
                                <button onClick={() => act(() => setStatus('active'))}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-accent/50 dark:text-green-400">
                                    <CircleCheck className="h-3.5 w-3.5" />Set Active
                                </button>
                            )}
                            {user.status !== 'pending' && (
                                <button onClick={() => act(() => setStatus('pending'))}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-yellow-700 hover:bg-accent/50 dark:text-yellow-400">
                                    <CircleOff className="h-3.5 w-3.5" />Set Pending
                                </button>
                            )}
                            {user.status !== 'block' && (
                                <button onClick={() => act(() => setStatus('block'))}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-accent/50 dark:text-red-400">
                                    <ShieldAlert className="h-3.5 w-3.5" />Block
                                </button>
                            )}

                            {/* Role toggle */}
                            <div className="my-1 border-t border-sidebar-border/50" />
                            {user.role !== 'super' && (
                                <button onClick={() => act(() => setRole('super'))}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent/50">
                                    <ShieldCheck className="h-3.5 w-3.5" />Make Super
                                </button>
                            )}
                            {user.role !== 'admin' && (
                                <button onClick={() => act(() => setRole('admin'))}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-accent/50 dark:text-blue-400">
                                    <ShieldCheck className="h-3.5 w-3.5" />Make Admin
                                </button>
                            )}
                            {user.role !== 'user' && (
                                <button onClick={() => act(() => setRole('user'))}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50">
                                    <UserCog className="h-3.5 w-3.5" />Make User
                                </button>
                            )}

                            {/* Revoke tokens */}
                            <div className="my-1 border-t border-sidebar-border/50" />
                            <button disabled={user.token_count === 0}
                                onClick={() => act(() => router.delete(`/admin/users/${user.id}/tokens`, { preserveScroll: true }))}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-yellow-700 hover:bg-accent/50 dark:text-yellow-400 disabled:opacity-40">
                                <LogOut className="h-3.5 w-3.5" />Revoke tokens ({user.token_count})
                            </button>

                            {/* Delete */}
                            <div className="my-1 border-t border-sidebar-border/50" />
                            <button onClick={() => act(() => router.delete(`/admin/users/${user.id}`))}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" />Delete
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
    const { users, search: initSearch, status: initStatus, role: initRole, summary, auth, organizations = [], can_invite_super = false } =
        usePage<PageProps>().props;

    const [search, setSearch]     = useState(initSearch);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [showInvite, setShowInvite] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            router.get('/admin/users', { search, status: initStatus, role: initRole }, {
                preserveState: true, preserveScroll: true, replace: true,
            });
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const applyFilter = (key: string, value: string) => {
        router.get('/admin/users', { search, status: initStatus, role: initRole, [key]: value }, {
            preserveState: true, preserveScroll: true, replace: true,
        });
    };

    const summaryCards = [
        { label: 'Total', value: summary.total, color: 'text-foreground', bg: 'bg-muted/40' },
        { label: 'Active', value: summary.active, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
        { label: 'Pending', value: summary.pending, color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
        { label: 'Block', value: summary.block, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
        { label: 'Super', value: summary.supers, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Admins', value: summary.admins, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Users', value: summary.users, color: 'text-foreground', bg: 'bg-muted/40' },
        { label: 'New this week', value: summary.new_this_week, color: 'text-foreground', bg: 'bg-muted/40' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Management" />

            {editUser && (
                <EditDrawer
                    user={editUser}
                    currentUserId={auth.user.id}
                    onClose={() => setEditUser(null)}
                />
            )}

            {showInvite && (
                <InviteUserDrawer
                    organizations={organizations}
                    canInviteSuper={can_invite_super}
                    onClose={() => setShowInvite(false)}
                />
            )}

            <div className="flex flex-col gap-6 p-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
                        <p className="text-muted-foreground">Manage accounts, roles, and API tokens.</p>
                    </div>
                    <Button className="gap-2" onClick={() => setShowInvite(true)}>
                        <UserPlus className="h-4 w-4" />Invite User
                    </Button>
                </div>

                {/* Summary strip */}
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
                    {summaryCards.map(({ label, value, color, bg }) => (
                        <div key={label} className={`rounded-xl border border-sidebar-border/70 ${bg} px-4 py-3`}>
                            <p className={`text-2xl font-bold ${color}`}>{value}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Table card */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card">

                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-3 border-b p-4">
                        <div className="relative min-w-[180px] flex-1">
                            <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search name or email…" className="h-8 pl-7 text-xs" />
                        </div>

                        {/* Status tabs */}
                        <div className="flex overflow-hidden rounded-lg border border-sidebar-border/50">
                            {(['all', 'active', 'pending', 'block'] as const).map(s => (
                                <button key={s} onClick={() => applyFilter('status', s)}
                                    className={`px-3 py-1.5 text-xs font-medium capitalize transition
                                        ${initStatus === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>

                        {/* Role tabs */}
                        <div className="flex overflow-hidden rounded-lg border border-sidebar-border/50">
                            {(['all', 'super', 'admin', 'user'] as const).map(r => (
                                <button key={r} onClick={() => applyFilter('role', r)}
                                    className={`px-3 py-1.5 text-xs font-medium capitalize transition
                                        ${initRole === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>

                        <span className="ml-auto text-xs text-muted-foreground">
                            {users.total} user{users.total !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left">
                                    {['User', 'Role', 'Status', 'Tokens', 'Last seen', 'Joined', ''].map(h => (
                                        <th key={h} className="whitespace-nowrap px-5 pb-3 pt-4 font-medium text-muted-foreground">
                                            {h}
                                        </th>
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
                                    <tr key={user.id} className="border-b last:border-0 transition hover:bg-muted/20">
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
                                        <td className="px-5 py-3"><RoleBadge role={user.role} platformRole={user.platform_role} /></td>
                                        <td className="px-5 py-3"><StatusBadge status={user.status} /></td>
                                        <td className="px-5 py-3">
                                            {user.token_count > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                                    <KeyRound className="h-3 w-3" />{user.token_count}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                                            {user.last_seen_ago}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                                            {user.created_ago}
                                        </td>
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
                                {users.from != null && users.to != null
                                    ? `Showing ${users.from}–${users.to} of ${users.total}`
                                    : `${users.total} total`}
                            </p>
                            <div className="flex items-center gap-1">
                                <button disabled={users.current_page === 1}
                                    onClick={() => router.get('/admin/users', { search, status: initStatus, role: initRole, page: users.current_page - 1 }, { preserveScroll: true })}
                                    className="rounded p-1.5 transition hover:bg-accent/50 disabled:opacity-30">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="px-2 text-xs text-muted-foreground">
                                    {users.current_page} / {users.last_page}
                                </span>
                                <button disabled={users.current_page === users.last_page}
                                    onClick={() => router.get('/admin/users', { search, status: initStatus, role: initRole, page: users.current_page + 1 }, { preserveScroll: true })}
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
