import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ClipboardList, Plus, Pencil, Trash2, X, Check, RefreshCw, Search,
    Users, CalendarCheck, Award, Gift, MapPin,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface FormRow {
    id: number;
    title: string;
    description: string | null;
    message: string | null;
    form_type: string | null;
    starts_at: string | null;
    ends_at: string | null;
    location: string | null;
    latitude: string | null;
    longitude: string | null;
    timezone: string | null;
    signup: string;
    attendance: string;
    status: string;
    is_active: boolean;
    group_id: number | null;
    meet_room_id: number | null;
    group: { id: number; name: string } | null;
    meet_room: { id: number; name: string } | null;
    registrations_count: number;
}

type PageProps = {
    organization: { id: number; name: string };
    forms: FormRow[];
    groups: { id: number; name: string }[];
    meetings: { id: number; name: string }[];
} & Record<string, unknown>;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Event Forms', href: '/company/forms' },
];

function useOrgQuery(organizationId: number) {
    const { auth } = usePage<{ auth: { user?: { is_super_admin?: boolean } } }>().props;
    return auth?.user?.is_super_admin ? `?organization_id=${organizationId}` : '';
}

function FormDrawer({
    form,
    groups,
    meetings,
    orgQuery,
    onClose,
}: {
    form?: FormRow | null;
    groups: { id: number; name: string }[];
    meetings: { id: number; name: string }[];
    orgQuery: string;
    onClose: () => void;
}) {
    const [values, setValues] = useState({
        title: form?.title ?? '',
        form_type: form?.form_type ?? '',
        description: form?.description ?? '',
        message: form?.message ?? '',
        starts_at: form?.starts_at ?? '',
        ends_at: form?.ends_at ?? '',
        location: form?.location ?? '',
        latitude: form?.latitude ?? '',
        longitude: form?.longitude ?? '',
        timezone: form?.timezone ?? '',
        group_id: form?.group_id?.toString() ?? '',
        meet_room_id: form?.meet_room_id?.toString() ?? '',
        signup: form?.signup ?? 'disabled',
        attendance: form?.attendance ?? 'disabled',
        status: form?.status === 'block' ? 'block' : (form?.status ?? 'active'),
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const isEdit = Boolean(form);

    const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

    const submit = () => {
        setSaving(true);
        setErrors({});
        const payload = {
            ...values,
            group_id: values.group_id ? Number(values.group_id) : null,
            meet_room_id: values.meet_room_id ? Number(values.meet_room_id) : null,
        };
        const opts = {
            preserveScroll: true,
            forceFormData: false,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: (e: Record<string, string>) => { setSaving(false); setErrors(e); },
        };
        if (isEdit && form) {
            router.patch(`/company/forms/${form.id}${orgQuery}`, payload, opts);
        } else {
            router.post(`/company/forms${orgQuery}`, payload, opts);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b p-6">
                    <h2 className="font-semibold">{isEdit ? 'Edit Event Form' : 'Create Event Form'}</h2>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-6">
                    <div>
                        <Label className="text-xs">Name *</Label>
                        <Input className="mt-1 h-9" value={values.title} onChange={(e) => set('title', e.target.value)} />
                        {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title}</p>}
                    </div>
                    <div>
                        <Label className="text-xs">Form type</Label>
                        <Input className="mt-1 h-9" value={values.form_type} onChange={(e) => set('form_type', e.target.value)} placeholder="e.g. registration, survey" />
                    </div>
                    <div>
                        <Label className="text-xs">Description</Label>
                        <textarea className="mt-1 min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={values.description} onChange={(e) => set('description', e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs">Message (shown after signup)</Label>
                        <textarea className="mt-1 min-h-[90px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={values.message} onChange={(e) => set('message', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Starts at</Label>
                            <Input type="datetime-local" className="mt-1 h-9" value={values.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Ends at</Label>
                            <Input type="datetime-local" className="mt-1 h-9" value={values.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Location</Label>
                        <Input className="mt-1 h-9" value={values.location} onChange={(e) => set('location', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Latitude</Label>
                            <Input className="mt-1 h-9" value={values.latitude} onChange={(e) => set('latitude', e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">Longitude</Label>
                            <Input className="mt-1 h-9" value={values.longitude} onChange={(e) => set('longitude', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <Label className="text-xs">Timezone</Label>
                        <Input className="mt-1 h-9" value={values.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="e.g. Africa/Lagos" />
                    </div>
                    <div>
                        <Label className="text-xs">Organization group</Label>
                        <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={values.group_id} onChange={(e) => set('group_id', e.target.value)}>
                            <option value="">None</option>
                            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs">Linked meeting</Label>
                        <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={values.meet_room_id} onChange={(e) => set('meet_room_id', e.target.value)}>
                            <option value="">None</option>
                            {meetings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs">Signup</Label>
                            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={values.signup} onChange={(e) => set('signup', e.target.value)}>
                                <option value="enabled">Enabled</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Attendance</Label>
                            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={values.attendance} onChange={(e) => set('attendance', e.target.value)}>
                                <option value="enabled">Enabled</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Status</Label>
                            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={values.status} onChange={(e) => set('status', e.target.value)}>
                                <option value="active">Active</option>
                                <option value="block">Blocked</option>
                            </select>
                        </div>
                    </div>
                    <Button className="w-full gap-2" disabled={saving || !values.title.trim()} onClick={submit}>
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {isEdit ? 'Save Changes' : 'Create Form'}
                    </Button>
                </div>
            </div>
        </>
    );
}

export default function EventFormsPage() {
    const { organization, forms, groups, meetings } = usePage<PageProps>().props;
    const orgQuery = useOrgQuery(organization.id);
    const [showCreate, setShowCreate] = useState(false);
    const [editForm, setEditForm] = useState<FormRow | null>(null);
    const [search, setSearch] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const filtered = useMemo(() => {
        if (!search.trim()) return forms;
        const q = search.toLowerCase();
        return forms.filter((f) => f.title.toLowerCase().includes(q) || (f.location ?? '').toLowerCase().includes(q));
    }, [forms, search]);

    const remove = (form: FormRow) => {
        if (!confirm(`Delete “${form.title}”? Applications, certificates and souvenirs for this form will be removed.`)) return;
        setDeletingId(form.id);
        router.delete(`/company/forms/${form.id}${orgQuery}`, {
            preserveScroll: true,
            onFinish: () => setDeletingId(null),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Event Forms" />
            {showCreate && (
                <FormDrawer groups={groups} meetings={meetings} orgQuery={orgQuery} onClose={() => setShowCreate(false)} />
            )}
            {editForm && (
                <FormDrawer form={editForm} groups={groups} meetings={meetings} orgQuery={orgQuery} onClose={() => setEditForm(null)} />
            )}

            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Event Forms</h1>
                        <p className="text-muted-foreground">
                            Create and manage forms for {organization.name} — applications, attendance, certificates, and souvenirs.
                        </p>
                    </div>
                    <Button className="gap-2" onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4" />Create Form
                    </Button>
                </div>

                <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="Search forms…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left">
                            <tr>
                                <th className="px-5 py-3 font-medium">Form</th>
                                <th className="px-5 py-3 font-medium">Schedule</th>
                                <th className="px-5 py-3 font-medium">Flags</th>
                                <th className="px-5 py-3 font-medium">Apps</th>
                                <th className="px-5 py-3 font-medium text-right">Manage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                                        <ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" />
                                        No event forms yet.
                                    </td>
                                </tr>
                            ) : filtered.map((f) => (
                                <tr key={f.id} className="border-b last:border-0 align-top">
                                    <td className="px-5 py-3">
                                        <p className="font-medium">{f.title}</p>
                                        {f.location && (
                                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" />{f.location}
                                            </p>
                                        )}
                                        {f.group && <p className="text-xs text-muted-foreground">Group: {f.group.name}</p>}
                                    </td>
                                    <td className="px-5 py-3 text-xs text-muted-foreground">
                                        <div>{f.starts_at ? f.starts_at.replace('T', ' ') : '—'}</div>
                                        <div>{f.ends_at ? f.ends_at.replace('T', ' ') : '—'}</div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${f.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>{f.status}</span>
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">Signup {f.signup}</span>
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">Attendance {f.attendance}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                            <Users className="h-3 w-3" />{f.registrations_count}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex flex-wrap justify-end gap-1">
                                            <Button size="sm" variant="outline" className="h-8 gap-1" asChild>
                                                <Link href={`/company/forms/${f.id}/applications${orgQuery}`}><Users className="h-3.5 w-3.5" />Apps</Link>
                                            </Button>
                                            {f.attendance === 'enabled' && (
                                                <Button size="sm" variant="outline" className="h-8 gap-1" asChild>
                                                    <Link href={`/company/forms/${f.id}/attendance${orgQuery}`}><CalendarCheck className="h-3.5 w-3.5" />Attendance</Link>
                                                </Button>
                                            )}
                                            <Button size="sm" variant="outline" className="h-8 gap-1" asChild>
                                                <Link href={`/company/forms/${f.id}/certificates${orgQuery}`}><Award className="h-3.5 w-3.5" />Certs</Link>
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-8 gap-1" asChild>
                                                <Link href={`/company/forms/${f.id}/souvenirs${orgQuery}`}><Gift className="h-3.5 w-3.5" />Souvenirs</Link>
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditForm(f)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" disabled={deletingId === f.id} onClick={() => remove(f)}>
                                                {deletingId === f.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
