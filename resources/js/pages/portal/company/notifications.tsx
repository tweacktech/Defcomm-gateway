import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Company Notifications"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Notifications', href: '/company/notifications' }]}
            columns={[
                { key: 'title', label: 'Title' },
                { key: 'audience', label: 'Audience' },
                { key: 'body', label: 'Body' },
            ]}
            rows={items.data || []}
            storeUrl="/company/notifications"
            fields={[
                { name: 'title', label: 'Title', required: true },
                { name: 'body', label: 'Body', type: 'textarea' },
                { name: 'audience', label: 'Audience', type: 'select', options: [
                    { value: 'all', label: 'All' }, { value: 'company', label: 'Company' }, { value: 'user', label: 'Users' },
                ]},
            ]}
        />
    );
}
