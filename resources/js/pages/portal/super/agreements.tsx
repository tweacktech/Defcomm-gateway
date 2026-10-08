import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Agreement Statements"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Agreements', href: '/super/agreements' }]}
            columns={[
                { key: 'title', label: 'Title' },
                { key: 'slug', label: 'Slug' },
                { key: 'is_active', label: 'Active', render: (r) => (r.is_active ? 'Yes' : 'No') },
            ]}
            rows={items.data || []}
            storeUrl="/super/agreements"
            updateUrl={(r) => `/super/agreements/${r.id}`}
            fields={[
                { name: 'title', label: 'Title', required: true },
                { name: 'slug', label: 'Slug' },
                { name: 'content', label: 'Content', type: 'textarea' },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
            ]}
        />
    );
}
