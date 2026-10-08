import { Head, router, usePage } from '@inertiajs/react';
import {
    Users, Plus, Pencil, X, Check, RefreshCw, Trash2, UserPlus, UserMinus, Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
}

interface GroupMember {
    id: number;
    user_id: number;
    status: string;
    join_date: string | null;
    name: string | null;
    email: string | null;
    role: string | null;
}

interface Group {
    id: number;
    name: string;
    description: string | null;
    member_count: number;
    created_at: string | null;
    members: GroupMember[];
}

type PageProps = {
    organization: { id: number; name: string };
    groups: Group[];
    users: OrgUser[];
    errors?: Record<string, string>;
} & Record<string, unknown>;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Groups', href: '/company/groups' },
];

function useOrgQuery(organizationId: number) {
    const { auth } = usePage<{ auth: { user?: { is_super_admin?: boolean } } }>().props;
    return auth?.user?.is_super_admin ? `?organization_id=${organizationId}` : '';
}

function GroupFormDrawer({
    group,
    orgQuery,
    onClose,
}: {
    group?: Group | null;
    orgQuery: string;
    onClose: () => void;
}) {
    const [name, setName] = useState(group?.name ?? '');
    const [description, setDescription] = useState(group?.description ?? '');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const isEdit = Boolean(group);

    const submit = () => {
        setSaving(true);
        setErrors({});
        const opts = {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: (e: Record<string, string>) => { setSaving(false); setErrors(e); },
        };
        if (isEdit && group) {
            router.patch(`/company/groups/${group.id}${orgQuery}`, { name, description }, opts);
        } else {
            router.post(`/company/groups${orgQuery}`, { name, description }, opts);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b p-6">
                    <h2 className="font-semibold">{isEdit ? 'Edit Group' : 'Create Group'}</h2>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    <div>
                        <Label className="text-xs">Name *</Label>
                        <Input className="mt-1 h-9" value={name} onChange={(e) => setName(e.target.value)} />
                        {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
                    </div>
                    <div>
                        <Label className="text-xs">Description</Label>
                        <Input className="mt-1 h-9" value={description} onChange={(e) => setDescription(e.target.value)} />
                        {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description}</p>}
                    </div>
                    <Button className="w-full gap-2" disabled={saving || !name.trim()} onClick={submit}>
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {isEdit ? 'Save Changes' : 'Create Group'}
                    </Button>
                </div>
            </div>
        </>
    );
}

function ManageMembersDrawer({
    group,
    users,
    orgQuery,
    onClose,
}: {
    group: Group;
    users: OrgUser[];
    orgQuery: string;
    onClose: () => void;
}) {
    const [memberId, setMemberId] = useState('');
    const [saving, setSaving] = useState(false);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [search, setSearch] = useState('');

    const memberUserIds = useMemo(
        () => new Set(group.members.map((m) => m.user_id)),
        [group.members],
    );

    const availableUsers = users.filter((u) => !memberUserIds.has(u.id));
    const filteredMembers = group.members.filter((m) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (m.name ?? '').toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q);
    });

    const addMember = () => {
        if (!memberId) return;
        setSaving(true);
        setErrors({});
        router.post(`/company/groups/${group.id}/members${orgQuery}`, {
            user_id: Number(memberId),
        }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); setMemberId(''); },
            onError: (e) => { setSaving(false); setErrors(e as Record<string, string>); },
        });
    };

    const removeMember = (userId: number) => {
        setRemovingId(userId);
        router.delete(`/company/groups/${group.id}/members/${userId}${orgQuery}`, {
            preserveScroll: true,
            onFinish: () => setRemovingId(null),
        });
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b p-6">
                    <div>
                        <h2 className="font-semibold">Manage Members</h2>
                        <p className="text-sm text-muted-foreground">{group.name}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-4 border-b p-6">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Add organization user</p>
                    <div className="flex gap-2">
                        <select
                            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
                            value={memberId}
                            onChange={(e) => setMemberId(e.target.value)}
                        >
                            <option value="">Select user</option>
                            {availableUsers.map((u) => (
                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                            ))}
                        </select>
                        <Button className="gap-2" disabled={saving || !memberId} onClick={addMember}>
                            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Add
                        </Button>
                    </div>
                    {availableUsers.length === 0 && (
                        <p className="text-xs text-muted-foreground">All organization users are already in this group.</p>
                    )}
                    {Object.values(errors).map((e, i) => (
                        <p key={i} className="text-xs text-destructive">{e}</p>
                    ))}
                </div>

                <div className="flex items-center gap-2 border-b px-6 py-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                        className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
                        placeholder="Search members…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredMembers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
                            <Users className="h-8 w-8 opacity-40" />
                            <p className="text-sm">No members yet</p>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {filteredMembers.map((m) => (
                                <li key={m.id} className="flex items-center justify-between gap-3 px-6 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{m.name ?? 'Unknown'}</p>
                                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                                            {m.status}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 gap-1 text-destructive hover:text-destructive"
                                            disabled={removingId === m.user_id}
                                            onClick={() => removeMember(m.user_id)}
                                        >
                                            {removingId === m.user_id
                                                ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                : <UserMinus className="h-3.5 w-3.5" />}
                                            Remove
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    );
}

export default function CompanyGroups() {
    const { organization, groups, users } = usePage<PageProps>().props;
    const orgQuery = useOrgQuery(organization.id);
    const [showCreate, setShowCreate] = useState(false);
    const [editGroup, setEditGroup] = useState<Group | null>(null);
    const [manageGroup, setManageGroup] = useState<Group | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [search, setSearch] = useState('');

    // Keep manage drawer in sync after Inertia reloads props
    const activeManageGroup = manageGroup
        ? groups.find((g) => g.id === manageGroup.id) ?? manageGroup
        : null;

    const filtered = groups.filter((g) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q);
    });

    const deleteGroup = (group: Group) => {
        if (!confirm(`Delete group “${group.name}”? Members will be removed from the group.`)) return;
        setDeletingId(group.id);
        router.delete(`/company/groups/${group.id}${orgQuery}`, {
            preserveScroll: true,
            onFinish: () => setDeletingId(null),
            onSuccess: () => {
                if (manageGroup?.id === group.id) setManageGroup(null);
                if (editGroup?.id === group.id) setEditGroup(null);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Groups" />

            {showCreate && (
                <GroupFormDrawer orgQuery={orgQuery} onClose={() => setShowCreate(false)} />
            )}
            {editGroup && (
                <GroupFormDrawer group={editGroup} orgQuery={orgQuery} onClose={() => setEditGroup(null)} />
            )}
            {activeManageGroup && (
                <ManageMembersDrawer
                    group={activeManageGroup}
                    users={users}
                    orgQuery={orgQuery}
                    onClose={() => setManageGroup(null)}
                />
            )}

            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
                        <p className="text-muted-foreground">
                            Create and manage groups for {organization.name}. Add or remove organization users.
                        </p>
                    </div>
                    <Button className="gap-2" onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4" />Create Group
                    </Button>
                </div>

                <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                        className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
                        placeholder="Search groups…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left">
                            <tr>
                                <th className="px-5 py-3 font-medium">Group</th>
                                <th className="px-5 py-3 font-medium">Members</th>
                                <th className="px-5 py-3 font-medium">Description</th>
                                <th className="px-5 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground">
                                        <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                                        No groups yet. Create one to get started.
                                    </td>
                                </tr>
                            ) : filtered.map((g) => (
                                <tr key={g.id} className="border-b last:border-0">
                                    <td className="px-5 py-3">
                                        <p className="font-medium">{g.name}</p>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                            <Users className="h-3 w-3" />
                                            {g.member_count}
                                        </span>
                                    </td>
                                    <td className="max-w-xs truncate px-5 py-3 text-muted-foreground">
                                        {g.description || '—'}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 gap-1"
                                                onClick={() => setManageGroup(g)}
                                            >
                                                <UserPlus className="h-3.5 w-3.5" />
                                                Members
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0"
                                                onClick={() => setEditGroup(g)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                disabled={deletingId === g.id}
                                                onClick={() => deleteGroup(g)}
                                            >
                                                {deletingId === g.id
                                                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                    : <Trash2 className="h-3.5 w-3.5" />}
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
