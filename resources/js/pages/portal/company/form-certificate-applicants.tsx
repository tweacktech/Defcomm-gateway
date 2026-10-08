import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, Mail, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';

type Applicant = {
    id: number;
    name: string | null;
    email: string | null;
    is_collected: boolean;
    is_sent: boolean;
};

type PageProps = {
    organization: { id: number; name: string };
    form: { id: number; title: string };
    certificate: { id: number; title: string; template_url: string | null };
    applicants: Applicant[];
} & Record<string, unknown>;

function useOrgQuery(organizationId: number) {
    const { auth } = usePage<{ auth: { user?: { is_super_admin?: boolean } } }>().props;
    return auth?.user?.is_super_admin ? `?organization_id=${organizationId}` : '';
}

export default function CertificateApplicantsPage() {
    const { organization, form, certificate, applicants } = usePage<PageProps>().props;
    const orgQuery = useOrgQuery(organization.id);
    const [selected, setSelected] = useState<number[]>([]);
    const [showMail, setShowMail] = useState(false);
    const [subject, setSubject] = useState(`Your certificate: ${certificate.title}`);
    const [message, setMessage] = useState(`Please find your certificate for ${form.title} attached.`);
    const [saving, setSaving] = useState(false);

    const toggle = (id: number) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    const toggleAll = () => setSelected(selected.length === applicants.length ? [] : applicants.map((a) => a.id));

    const toggleCollect = (a: Applicant) => {
        router.post(`/company/forms/${form.id}/certificates/${certificate.id}/collect${orgQuery}`, {
            event_registration_id: a.id,
            is_collected: !a.is_collected,
        }, { preserveScroll: true });
    };

    const sendMail = () => {
        setSaving(true);
        router.post(`/company/forms/${form.id}/certificates/${certificate.id}/mail${orgQuery}`, {
            registration_ids: selected,
            subject,
            message,
        }, {
            preserveScroll: true,
            onSuccess: () => { setShowMail(false); setSaving(false); },
            onFinish: () => setSaving(false),
        });
    };

    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Event Forms', href: '/company/forms' },
            { title: form.title, href: `/company/forms/${form.id}/applications` },
            { title: 'Certificates', href: `/company/forms/${form.id}/certificates` },
            { title: certificate.title, href: `/company/forms/${form.id}/certificates/${certificate.id}/applicants` },
        ]}>
            <Head title={`${certificate.title} — Applicants`} />

            {showMail && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowMail(false)} />
                    <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                        <div className="flex items-center justify-between border-b p-6">
                            <h2 className="font-semibold">Mail certificate ({selected.length})</h2>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowMail(false)}><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="space-y-4 p-6">
                            <div><Label className="text-xs">Subject</Label><Input className="mt-1 h-9" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
                            <div><Label className="text-xs">Message</Label><textarea className="mt-1 min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={message} onChange={(e) => setMessage(e.target.value)} /></div>
                            <Button className="w-full gap-2" disabled={saving || !subject || !message} onClick={sendMail}>
                                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Send with template
                            </Button>
                        </div>
                    </div>
                </>
            )}

            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{certificate.title}</h1>
                        <p className="text-muted-foreground">Applicants · {form.title} · {organization.name}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild><Link href={`/company/forms/${form.id}/certificates${orgQuery}`}>Back</Link></Button>
                        <Button className="gap-2" disabled={selected.length === 0} onClick={() => setShowMail(true)}>
                            <Mail className="h-4 w-4" />Mail selected
                        </Button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3"><input type="checkbox" checked={applicants.length > 0 && selected.length === applicants.length} onChange={toggleAll} /></th>
                                <th className="px-4 py-3">Applicant</th>
                                <th className="px-4 py-3">Collected</th>
                                <th className="px-4 py-3">Sent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {applicants.map((a) => (
                                <tr key={a.id} className="border-b last:border-0">
                                    <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} /></td>
                                    <td className="px-4 py-3">
                                        <p className="font-medium">{a.name}</p>
                                        <p className="text-xs text-muted-foreground">{a.email}</p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleCollect(a)}
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.is_collected ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}
                                        >
                                            {a.is_collected ? 'Collected' : 'Not collected'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.is_sent ? 'bg-blue-500/10 text-blue-600' : 'bg-muted text-muted-foreground'}`}>
                                            {a.is_sent ? 'Sent' : 'Not sent'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {applicants.length === 0 && (
                                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">No applicants yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
