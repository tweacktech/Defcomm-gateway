import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, RefreshCw, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';

type PageProps = {
    organization: { id: number; name: string };
    form: { id: number; title: string };
    attendance: Array<{
        id: number; user_id: number; name: string | null; email: string | null;
        comment: string | null; location: string | null;
        clock_in_at: string | null; clock_out_at: string | null;
        created_at: string | null;
    }>;
    registrants: Array<{ user_id: number; name: string | null; email: string | null }>;
} & Record<string, unknown>;

function useOrgQuery(organizationId: number) {
    const { auth } = usePage<{ auth: { user?: { is_super_admin?: boolean } } }>().props;
    return auth?.user?.is_super_admin ? `?organization_id=${organizationId}` : '';
}

export default function FormAttendancePage() {
    const { organization, form, attendance, registrants } = usePage<PageProps>().props;
    const orgQuery = useOrgQuery(organization.id);
    const [userId, setUserId] = useState('');
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);

    const mark = () => {
        setSaving(true);
        router.post(`/company/forms/${form.id}/attendance/mark${orgQuery}`, {
            user_id: Number(userId),
            comment: comment || undefined,
        }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); setUserId(''); setComment(''); },
            onFinish: () => setSaving(false),
        });
    };

    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Event Forms', href: '/company/forms' },
            { title: form.title, href: `/company/forms/${form.id}/applications` },
            { title: 'Attendance', href: `/company/forms/${form.id}/attendance` },
        ]}>
            <Head title={`${form.title} — Attendance`} />
            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
                        <p className="text-muted-foreground">{form.title} · {organization.name}</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={`/company/forms/${form.id}/applications${orgQuery}`}>Back to applications</Link>
                    </Button>
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-3">
                    <h2 className="font-semibold flex items-center gap-2"><UserPlus className="h-4 w-4" />Mark attendance</h2>
                    <div className="grid gap-3 md:grid-cols-3">
                        <div>
                            <Label className="text-xs">Applicant *</Label>
                            <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
                                <option value="">Select user</option>
                                {registrants.map((r) => (
                                    <option key={r.user_id} value={r.user_id}>{r.name} ({r.email})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs">Comment</Label>
                            <Input className="mt-1 h-9" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional note" />
                        </div>
                        <div className="flex items-end">
                            <Button className="w-full gap-2" disabled={!userId || saving} onClick={mark}>
                                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Mark checked-in
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Comment</th>
                                <th className="px-4 py-3">Clock in</th>
                                <th className="px-4 py-3">Clock out</th>
                                <th className="px-4 py-3">Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendance.map((a) => (
                                <tr key={a.id} className="border-b last:border-0">
                                    <td className="px-4 py-3">
                                        <p className="font-medium">{a.name}</p>
                                        <p className="text-xs text-muted-foreground">{a.email}</p>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{a.comment || '—'}</td>
                                    <td className="px-4 py-3 text-xs">{a.clock_in_at ? new Date(a.clock_in_at).toLocaleString() : '—'}</td>
                                    <td className="px-4 py-3 text-xs">{a.clock_out_at ? new Date(a.clock_out_at).toLocaleString() : '—'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{a.location || '—'}</td>
                                </tr>
                            ))}
                            {attendance.length === 0 && (
                                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No attendance records yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
