import { Head, Link, usePage } from '@inertiajs/react';
import { Building2, Users, KeyRound, ArrowLeft, ShieldCheck, UserCog } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Organization {
    id: number;
    name: string;
    email: string | null;
    status: string;
    users_count: number;
    client_credentials_active: boolean;
    client_id: string | null;
    created_at: string;
}

interface OrgUser {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
    status: string;
    created_at: string;
}

type PageProps = {
    organization: Organization;
    users: { data: OrgUser[]; total: number };
} & Record<string, unknown>;

export default function AdminOrganizationShow() {
    const { organization, users } = usePage<PageProps>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Companies', href: '/admin/organizations' },
        { title: organization.name, href: `/admin/organizations/${organization.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={organization.name} />

            <div className="flex flex-col gap-6 p-6">
                <Link href="/admin/organizations" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" />Back to companies
                </Link>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="rounded-xl border bg-card p-6 lg:col-span-1">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-lg bg-primary/10 p-3"><Building2 className="h-6 w-6 text-primary" /></div>
                            <div>
                                <h1 className="text-xl font-bold">{organization.name}</h1>
                                <p className="text-sm text-muted-foreground capitalize">{organization.status}</p>
                            </div>
                        </div>
                        <dl className="space-y-3 text-sm">
                            <div><dt className="text-muted-foreground">Email</dt><dd>{organization.email ?? '—'}</dd></div>
                            <div><dt className="text-muted-foreground">Users</dt><dd>{organization.users_count}</dd></div>
                            <div>
                                <dt className="text-muted-foreground">API credentials</dt>
                                <dd>{organization.client_credentials_active ? (
                                    <span className="flex items-center gap-1 text-green-600"><KeyRound className="h-3.5 w-3.5" />Active</span>
                                ) : 'Not configured'}</dd>
                            </div>
                            {organization.client_id && (
                                <div><dt className="text-muted-foreground">Client ID</dt><dd className="font-mono text-xs">{organization.client_id}</dd></div>
                            )}
                        </dl>
                        <div className="mt-6 flex flex-col gap-2">
                            <Link
                                href={`/company/credentials?organization_id=${organization.id}`}
                                className="rounded-lg border px-4 py-2 text-center text-sm hover:bg-accent/50"
                            >
                                Manage credentials
                            </Link>
                            <Link
                                href={`/company/users?organization_id=${organization.id}`}
                                className="rounded-lg border px-4 py-2 text-center text-sm hover:bg-accent/50"
                            >
                                Manage users
                            </Link>
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card lg:col-span-2">
                        <div className="flex items-center gap-3 border-b p-6">
                            <Users className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Company Users ({users.total})</h2>
                        </div>
                        <div className="divide-y">
                            {users.data.length === 0 ? (
                                <p className="p-8 text-center text-sm text-muted-foreground">No users in this company yet.</p>
                            ) : users.data.map(user => (
                                <div key={user.id} className="flex items-center justify-between px-6 py-4">
                                    <div>
                                        <p className="font-medium">{user.name}</p>
                                        <p className="text-sm text-muted-foreground">{user.email}</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="flex items-center gap-1 capitalize">
                                            {user.role === 'company_admin' ? <ShieldCheck className="h-3 w-3" /> : <UserCog className="h-3 w-3" />}
                                            {user.role_label}
                                        </span>
                                        <span className="capitalize text-muted-foreground">{user.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
