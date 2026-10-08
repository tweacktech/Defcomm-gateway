import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Store Users"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Store Users', href: '/super/store/users' }]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'status', label: 'Status' },
                { key: 'created_at', label: 'Joined' },
            ]}
            rows={items.data || []}
        />
    );
}
