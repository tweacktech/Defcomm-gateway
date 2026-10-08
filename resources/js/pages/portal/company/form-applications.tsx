import { Head, Link, router, usePage } from '@inertiajs/react';
import { Award, CalendarCheck, Gift, Mail, Search, Users, X, Check, RefreshCw, Eye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';

type Registration = {
    id: number;
    user_id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    data: Record<string, unknown> | null;
    created_at: string | null;
};

type PageProps = {
    organization: { id: number; name: string };
    form: { id: number; title: string; attendance: string };
    registrations: Registration[];
    counts: { applications: number; attendance: number; certificates: number; souvenirs: number };
} & Record<string, unknown>;

function useOrgQuery(organizationId: number) {
    const { auth } = usePage<{ auth: { user?: { is_super_admin?: boolean } } }>().props;
    return auth?.user?.is_super_admin ? `?organization_id=${organizationId}` : '';
}

export default function FormApplicationsPage() {
    const { organization, form, registrations, counts } = usePage<PageProps>().props;
    const orgQuery = useOrgQuery(organization.id);
    const [selected, setSelected] = useState<number[]>([]);
    const [search, setSearch] = useState('');
    const [viewReg, setViewReg] = useState<Registration | null>(null);
    const [showMail, setShowMail] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const filtered = useMemo(() => {
        if (!search.trim()) return registrations;
        const q = search.toLowerCase();
        return registrations.filter((r) =>
            (r.name ?? '').toLowerCase().includes(q)
            || (r.email ?? '').toLowerCase().includes(q)
            || (r.phone ?? '').toLowerCase().includes(q),
        );
    }, [registrations, search]);

    const toggle = (id: number) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleAll = () => {
        if (selected.length === filtered.length) setSelected([]);
        else setSelected(filtered.map((r) => r.id));
    };

    const sendMail = () => {
        setSaving(true);
        router.post(`/company/forms/${form.id}/applications/mail${orgQuery}`, {
            registration_ids: selected,
            subject,
            message,
        }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); setShowMail(false); setSubject(''); setMessage(''); },
            onFinish: () => setSaving(false),
        });
    };

    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Event Forms', href: '/company/forms' },
            { title: form.title, href: `/company/forms/${form.id}/applications` },
        ]}>
            <Head title={`${form.title} — Applications`} />

            {viewReg && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setViewReg(null)} />
                    <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                        <div className="flex items-center justify-between border-b p-6">
                            <h2 className="font-semibold">Application detail</h2>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setViewReg(null)}><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="space-y-3 overflow-y-auto p-6 text-sm">
                            <p><span className="text-muted-foreground">Name:</span> {viewReg.name}</p>
                            <p><span className="text-muted-foreground">Email:</span> {viewReg.email}</p>
                            <p><span className="text-muted-foreground">Phone:</span> {viewReg.phone || '—'}</p>
                            <p><span className="text-muted-foreground">Status:</span> {viewReg.status}</p>
                            <div>
                                <p className="mb-1 text-muted-foreground">Submitted data</p>
                                <pre className="overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
                                    {JSON.stringify(viewReg.data ?? {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {showMail && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowMail(false)} />
                    <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                        <div className="flex items-center justify-between border-b p-6">
                            <h2 className="font-semibold">Mail selected ({selected.length})</h2>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowMail(false)}><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="space-y-4 p-6">
                            <div>
                                <Label className="text-xs">Subject *</Label>
                                <Input className="mt-1 h-9" value={subject} onChange={(e) => setSubject(e.target.value)} />
                            </div>
                            <div>
                                <Label className="text-xs">Message *</Label>
                                <textarea className="mt-1 min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={message} onChange={(e) => setMessage(e.target.value)} />
                            </div>
                            <Button className="w-full gap-2" disabled={saving || !subject || !message} onClick={sendMail}>
                                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Send Mail
                            </Button>
                        </div>
                    </div>
                </>
            )}

            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{form.title}</h1>
                        <p className="text-muted-foreground">Applications for {organization.name}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="gap-2" asChild>
                            <Link href={`/company/forms/${form.id}/attendance${orgQuery}`}><CalendarCheck className="h-4 w-4" />Attendance</Link>
                        </Button>
                        <Button variant="outline" className="gap-2" asChild>
                            <Link href={`/company/forms/${form.id}/certificates${orgQuery}`}><Award className="h-4 w-4" />Certificates</Link>
                        </Button>
                        <Button variant="outline" className="gap-2" asChild>
                            <Link href={`/company/forms/${form.id}/souvenirs${orgQuery}`}><Gift className="h-4 w-4" />Souvenirs</Link>
                        </Button>
                        <Button className="gap-2" disabled={selected.length === 0} onClick={() => setShowMail(true)}>
                            <Mail className="h-4 w-4" />Mail selected
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                    {[
                        { label: 'Applications', value: counts.applications, icon: Users },
                        { label: 'Attendance', value: counts.attendance, icon: CalendarCheck },
                        { label: 'Certificates', value: counts.certificates, icon: Award },
                        { label: 'Souvenirs', value: counts.souvenirs, icon: Gift },
                    ].map((s) => (
                        <div key={s.label} className="rounded-xl border bg-card p-4">
                            <div className="flex items-center gap-2 text-muted-foreground"><s.icon className="h-4 w-4" /><span className="text-xs uppercase">{s.label}</span></div>
                            <p className="mt-2 text-2xl font-bold">{s.value}</p>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="Search applicants…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3"><input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={toggleAll} /></th>
                                <th className="px-4 py-3">Applicant</th>
                                <th className="px-4 py-3">Phone</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">View</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => (
                                <tr key={r.id} className="border-b last:border-0">
                                    <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} /></td>
                                    <td className="px-4 py-3">
                                        <p className="font-medium">{r.name}</p>
                                        <p className="text-xs text-muted-foreground">{r.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{r.phone || '—'}</td>
                                    <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{r.status}</span></td>
                                    <td className="px-4 py-3 text-right">
                                        <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setViewReg(r)}>
                                            <Eye className="h-3.5 w-3.5" />Detail
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No applications yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
