import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Plans"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Plans', href: '/super/plans' }]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'price', label: 'Price' },
                { key: 'description', label: 'Description' },
            ]}
            rows={items.data || []}
            storeUrl="/super/plans"
            fields={[
                { name: 'name', label: 'Name', required: true },
                { name: 'price', label: 'Price' },
                { name: 'description', label: 'Description', type: 'textarea' },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
            ]}
        />
    );
}
