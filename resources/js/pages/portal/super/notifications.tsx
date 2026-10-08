import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Notifications"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Notifications', href: '/super/notifications' }]}
            columns={[
                { key: 'title', label: 'Title' },
                { key: 'audience', label: 'Audience' },
                { key: 'is_active', label: 'Active', render: (r) => (r.is_active ? 'Yes' : 'No') },
            ]}
            rows={items.data || []}
            storeUrl="/super/notifications"
            updateUrl={(r) => `/super/notifications/${r.id}`}
            deleteUrl={(r) => `/super/notifications/${r.id}`}
            fields={[
                { name: 'title', label: 'Title', required: true },
                { name: 'body', label: 'Body', type: 'textarea' },
                { name: 'audience', label: 'Audience', type: 'select', options: [
                    { value: 'all', label: 'All' }, { value: 'super', label: 'Super' },
                    { value: 'company', label: 'Company' }, { value: 'user', label: 'Users' },
                ]},
                { name: 'is_active', label: 'Active', type: 'checkbox' },
            ]}
        />
    );
}
