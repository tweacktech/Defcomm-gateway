import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Store Apps"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Store Apps', href: '/super/store/apps' }]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'platform', label: 'Platform' },
                { key: 'version', label: 'Version' },
                { key: 'status', label: 'Status' },
                { key: 'user', label: 'Owner', render: (r) => r.user?.email || '—' },
            ]}
            rows={items.data || []}
            statusUrl={(r) => `/super/store/apps/${r.id}`}
            statusActions={[
                { label: 'Approve', value: 'approved' },
                { label: 'Reject', value: 'rejected' },
            ]}
        />
    );
}
