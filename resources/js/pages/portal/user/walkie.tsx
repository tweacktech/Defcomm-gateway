import { Head, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';

export default function WalkiePage() {
    const channels = (usePage().props as any).channels || [];

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Walkie-Talkie', href: '/app/walkie' }]}>
            <Head title="Walkie-Talkie" />
            <div className="flex flex-col gap-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold">Walkie-Talkie</h1>
                    <p className="text-sm text-muted-foreground">
                        Channel management uses the Walkie service API with your organization credentials and an X-Service-Key for service key <code>walkie</code>.
                    </p>
                </div>
                <div className="rounded-xl border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/40 text-left">
                            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Frequency</th><th className="px-4 py-3">Status</th></tr>
                        </thead>
                        <tbody>
                            {channels.map((c: any) => (
                                <tr key={c.id} className="border-b"><td className="px-4 py-3">{c.name}</td><td className="px-4 py-3">{c.frequency || '—'}</td><td className="px-4 py-3">{c.status}</td></tr>
                            ))}
                            {channels.length === 0 && <tr><td className="px-4 py-8 text-muted-foreground" colSpan={3}>No channels yet. Create via POST /api/walkie/channels.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
