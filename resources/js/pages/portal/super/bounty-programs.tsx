import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Bounty Programs"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Bounty Programs', href: '/super/bounty/programs' }]}
            columns={[
                { key: 'title', label: 'Title' },
                { key: 'detail', label: 'Detail' },
                { key: 'is_active', label: 'Active', render: (r) => (r.is_active ? 'Yes' : 'No') },
            ]}
            rows={items.data || []}
            storeUrl="/super/bounty/programs"
            updateUrl={(r) => `/super/bounty/programs/${r.id}`}
            fields={[
                { name: 'title', label: 'Title', required: true },
                { name: 'detail', label: 'Detail', type: 'textarea' },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
            ]}
        />
    );
}
