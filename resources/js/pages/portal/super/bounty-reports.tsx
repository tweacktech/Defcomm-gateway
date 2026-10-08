import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Bounty Reports"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Bounty Reports', href: '/super/bounty/reports' }]}
            columns={[
                { key: 'ref', label: 'Ref' },
                { key: 'title', label: 'Title' },
                { key: 'status', label: 'Status' },
                { key: 'user', label: 'Reporter', render: (r) => r.user?.username || r.user?.email || '—' },
            ]}
            rows={items.data || []}
            statusUrl={(r) => `/super/bounty/reports/${r.id}`}
            statusActions={[
                { label: 'Approve', value: 'approved' },
                { label: 'Fixed', value: 'fixed' },
                { label: 'Reject', value: 'rejected' },
            ]}
        />
    );
}
