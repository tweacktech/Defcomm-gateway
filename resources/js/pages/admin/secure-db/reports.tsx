import { Head, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

export default function SecureDbReports() {
    const { projects, selected_project_id, reports } = usePage<{
        projects: Array<{ id: number; name: string }>;
        selected_project_id: number | null;
        reports: Record<string, Record<string, unknown>> | null;
    }>().props;

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Reports')}>
            <Head title="Secure DB — Reports" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">Reports</h1>
                    <select className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                        value={selected_project_id ?? ''} onChange={e => router.get('/admin/secure-db/reports', { project_id: e.target.value })}>
                        <option value="">Select project</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                {reports ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(reports).map(([name, data]) => (
                            <div key={name} className="rounded-xl border border-sidebar-border/70 bg-card p-5">
                                <h3 className="font-semibold capitalize mb-3">{name} Report</h3>
                                <dl className="space-y-1.5 text-sm">
                                    {Object.entries(data).map(([k, v]) => (
                                        <div key={k} className="flex justify-between">
                                            <dt className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</dt>
                                            <dd className="font-medium">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground">Select a project to view reports.</p>
                )}
            </div>
        </AppLayout>
    );
}
