import { Head, Link, router, usePage } from '@inertiajs/react';
import { Gift, Plus, Pencil, Trash2, X, Check, RefreshCw, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';

type Souvenir = {
    id: number;
    title: string;
    status: string;
    image_url: string | null;
    applicants_count: number;
};

type PageProps = {
    organization: { id: number; name: string };
    form: { id: number; title: string };
    souvenirs: Souvenir[];
} & Record<string, unknown>;

function useOrgQuery(organizationId: number) {
    const { auth } = usePage<{ auth: { user?: { is_super_admin?: boolean } } }>().props;
    return auth?.user?.is_super_admin ? `?organization_id=${organizationId}` : '';
}

function SouvenirDrawer({
    formId, orgQuery, item, onClose,
}: {
    formId: number; orgQuery: string; item?: Souvenir | null; onClose: () => void;
}) {
    const [title, setTitle] = useState(item?.title ?? '');
    const [status, setStatus] = useState(item?.status ?? 'active');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = () => {
        setSaving(true);
        const data = { title, status, image: file ?? undefined };
        const opts = {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onFinish: () => setSaving(false),
        };
        if (item) {
            router.post(`/company/forms/${formId}/souvenirs/${item.id}${orgQuery}`, { ...data, _method: 'patch' }, opts);
        } else {
            router.post(`/company/forms/${formId}/souvenirs${orgQuery}`, data, opts);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b p-6">
                    <h2 className="font-semibold">{item ? 'Edit Souvenir' : 'Create Souvenir'}</h2>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-4 p-6">
                    <div><Label className="text-xs">Name *</Label><Input className="mt-1 h-9" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                    <div>
                        <Label className="text-xs">Status</Label>
                        <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs">Image</Label>
                        <Input type="file" accept="image/*" className="mt-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        {item?.image_url && <img src={item.image_url} alt="" className="mt-2 max-h-32 rounded border object-contain" />}
                    </div>
                    <Button className="w-full gap-2" disabled={saving || !title.trim()} onClick={submit}>
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {item ? 'Save' : 'Create'}
                    </Button>
                </div>
            </div>
        </>
    );
}

export default function FormSouvenirsPage() {
    const { organization, form, souvenirs } = usePage<PageProps>().props;
    const orgQuery = useOrgQuery(organization.id);
    const [showCreate, setShowCreate] = useState(false);
    const [edit, setEdit] = useState<Souvenir | null>(null);

    const remove = (s: Souvenir) => {
        if (!confirm(`Delete souvenir “${s.title}”?`)) return;
        router.delete(`/company/forms/${form.id}/souvenirs/${s.id}${orgQuery}`, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Event Forms', href: '/company/forms' },
            { title: form.title, href: `/company/forms/${form.id}/applications` },
            { title: 'Souvenirs', href: `/company/forms/${form.id}/souvenirs` },
        ]}>
            <Head title={`${form.title} — Souvenirs`} />
            {showCreate && <SouvenirDrawer formId={form.id} orgQuery={orgQuery} onClose={() => setShowCreate(false)} />}
            {edit && <SouvenirDrawer formId={form.id} orgQuery={orgQuery} item={edit} onClose={() => setEdit(null)} />}

            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Gift className="h-6 w-6" />Souvenirs</h1>
                        <p className="text-muted-foreground">{form.title} · {organization.name}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild><Link href={`/company/forms/${form.id}/applications${orgQuery}`}>Applications</Link></Button>
                        <Button className="gap-2" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />Add Souvenir</Button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3">Souvenir</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Applicants</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {souvenirs.map((s) => (
                                <tr key={s.id} className="border-b last:border-0">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {s.image_url && <img src={s.image_url} alt="" className="h-10 w-14 rounded border object-cover" />}
                                            <span className="font-medium">{s.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{s.status}</span></td>
                                    <td className="px-4 py-3">{s.applicants_count}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1">
                                            <Button size="sm" variant="outline" className="h-8 gap-1" asChild>
                                                <Link href={`/company/forms/${form.id}/souvenirs/${s.id}/applicants${orgQuery}`}>
                                                    <Users className="h-3.5 w-3.5" />Applicants
                                                </Link>
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => remove(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {souvenirs.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No souvenirs yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
