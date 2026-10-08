import { Head, Link, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';

type Applicant = {
    id: number;
    name: string | null;
    email: string | null;
    is_collected: boolean;
};

type PageProps = {
    organization: { id: number; name: string };
    form: { id: number; title: string };
    souvenir: { id: number; title: string; image_url: string | null };
    applicants: Applicant[];
} & Record<string, unknown>;

function useOrgQuery(organizationId: number) {
    const { auth } = usePage<{ auth: { user?: { is_super_admin?: boolean } } }>().props;
    return auth?.user?.is_super_admin ? `?organization_id=${organizationId}` : '';
}

export default function SouvenirApplicantsPage() {
    const { organization, form, souvenir, applicants } = usePage<PageProps>().props;
    const orgQuery = useOrgQuery(organization.id);

    const toggleCollect = (a: Applicant) => {
        router.post(`/company/forms/${form.id}/souvenirs/${souvenir.id}/collect${orgQuery}`, {
            event_registration_id: a.id,
            is_collected: !a.is_collected,
        }, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={[
            { title: 'Dashboard', href: '/dashboard' },
            { title: 'Event Forms', href: '/company/forms' },
            { title: form.title, href: `/company/forms/${form.id}/applications` },
            { title: 'Souvenirs', href: `/company/forms/${form.id}/souvenirs` },
            { title: souvenir.title, href: `/company/forms/${form.id}/souvenirs/${souvenir.id}/applicants` },
        ]}>
            <Head title={`${souvenir.title} — Applicants`} />
            <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{souvenir.title}</h1>
                        <p className="text-muted-foreground">Applicants · {form.title} · {organization.name}</p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={`/company/forms/${form.id}/souvenirs${orgQuery}`}>Back</Link>
                    </Button>
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left">
                            <tr>
                                <th className="px-4 py-3">Applicant</th>
                                <th className="px-4 py-3">Collected</th>
                            </tr>
                        </thead>
                        <tbody>
                            {applicants.map((a) => (
                                <tr key={a.id} className="border-b last:border-0">
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
                                </tr>
                            ))}
                            {applicants.length === 0 && (
                                <tr><td colSpan={2} className="px-4 py-10 text-center text-muted-foreground">No applicants yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
