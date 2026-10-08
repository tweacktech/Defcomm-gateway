import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Bounty Users"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Bounty Users', href: '/super/bounty/users' }]}
            columns={[
                { key: 'username', label: 'Username' },
                { key: 'email', label: 'Email' },
                { key: 'status', label: 'Status' },
                { key: 'balance', label: 'Balance' },
            ]}
            rows={items.data || []}
            statusUrl={(r) => `/super/bounty/users/${r.id}`}
            statusActions={[
                { label: 'Activate', value: 'active' },
                { label: 'Block', value: 'block' },
            ]}
        />
    );
}
