import { Head, Link, router, usePage } from '@inertiajs/react';
import { Award, Plus, Pencil, Trash2, X, Check, RefreshCw, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';

type Cert = {
    id: number;
    title: string;
    status: string;
    template_url: string | null;
    applicants_count: number;
};

type PageProps = {
    organization: { id: number; name: string };
    form: { id: number; title: string };
    certificates: Cert[];
} & Record<string, unknown>;

function useOrgQuery(organizationId: number) {
    const { auth } = usePage<{ auth: { user?: { is_super_admin?: boolean } } }>().props;
    return auth?.user?.is_super_admin ? `?organization_id=${organizationId}` : '';
}

function CertDrawer({
    formId,
    orgQuery,
    cert,
    onClose,
}: {
    formId: number;
    orgQuery: string;
    cert?: Cert | null;
    onClose: () => void;
}) {
    const [title, setTitle] = useState(cert?.title ?? '');
    const [status, setStatus] = useState(cert?.status ?? 'active');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

    const submit = () => {
        setSaving(true);
        const data = { title, status, template: file ?? undefined };
        const opts = {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onFinish: () => setSaving(false),
        };
        if (cert) {
            router.post(`/company/forms/${formId}/certificates/${cert.id}${orgQuery}`, {
                ...data,
                _method: 'patch',
            }, opts);
        } else {
            router.post(`/company/forms/${formId}/certificates${orgQuery}`, data, opts);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
            <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b p-6">
                    <h2 className="font-semibold">{cert ? 'Edit Certificate' : 'Create Certificate'}</h2>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-4 p-6">
                    <div>
                        <Label className="text-xs">Name *</Label>
                        <Input className="mt-1 h-9" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div>
                        <Label className="text-xs">Status</Label>
                        <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                        </select>
                    </div>
                    <div>
                        <Label className="text-xs">Template image</Label>
                        <Input type="file" accept="image/*" className="mt-1" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        {cert?.template_url && (
                            <img src={cert.template_url} alt="" className="mt-2 max-h-32 rounded border object-contain" />
                        )}
                    </div>
                    <Button className="w-full gap-2" disabled={saving || !title.trim()} onClick={submit}>
                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {cert ? 'Save' : 'Create'}
                    </Button>
                </div>
            </div>
        </>
    );
}

export default function FormCertificatesPage() {
    const { organization, form, certificates } = usePage<PageProps>().props;
    const orgQuery = useOrgQuery(organization.id);
    const [showCreate, setShowCreate] = useState(false);
    const [edit, setEdit] = useState<Cert | null>(null);

    const remove = (c: Cert) => {
        if (!confirm(`Delete certificate “${c.title}”?`)) return;
        router.delete(`/company/forms/${form.id}/certificates/${c.id}${orgQuery}`, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Event Forms', href: '/company/forms' },
            { title: form.title, href: `/company/forms/${form.id}/applications` },
            { title: 'Certificates', href: `/company/forms/${form.id}/certificates` },
        ]}>
            <Head title={`${form.title} — Certificates`} />
            {showCreate && <CertDrawer formId={form.id} orgQuery={orgQuery} onClose={() => setShowCreate(false)} />}
            {edit && <CertDrawer formId={form.id} orgQuery={orgQuery} cert={edit} onClose={() => setEdit(null)} />}

            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Award className="h-6 w-6" />Certificates</h1>
                        <p className="text-muted-foreground">{form.title}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild><Link href={`/company/forms/${form.id}/applications${orgQuery}`}>Applications</Link></Button>
                        <Button className="gap-2" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />Add Certificate</Button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3">Certificate</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Applicants</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {certificates.map((c) => (
                                <tr key={c.id} className="border-b last:border-0">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {c.template_url && <img src={c.template_url} alt="" className="h-10 w-14 rounded border object-cover" />}
                                            <span className="font-medium">{c.title}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.status}</span></td>
                                    <td className="px-4 py-3">{c.applicants_count}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1">
                                            <Button size="sm" variant="outline" className="h-8 gap-1" asChild>
                                                <Link href={`/company/forms/${form.id}/certificates/${c.id}/applicants${orgQuery}`}>
                                                    <Users className="h-3.5 w-3.5" />Applicants
                                                </Link>
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {certificates.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No certificates yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
