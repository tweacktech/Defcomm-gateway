import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Languages"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Languages', href: '/super/languages' }]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'code', label: 'Code' },
                { key: 'is_active', label: 'Active', render: (r) => (r.is_active ? 'Yes' : 'No') },
            ]}
            rows={items.data || []}
            storeUrl="/super/languages"
            updateUrl={(r) => `/super/languages/${r.id}`}
            fields={[
                { name: 'name', label: 'Name', required: true },
                { name: 'code', label: 'Code', required: true },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
            ]}
        />
    );
}
