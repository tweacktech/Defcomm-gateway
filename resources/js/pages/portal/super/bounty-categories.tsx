import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Bounty Categories"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Bounty Categories', href: '/super/bounty/categories' }]}
            columns={[
                { key: 'label', label: 'Label' },
                { key: 'description', label: 'Description' },
                { key: 'subs', label: 'Subs', render: (r) => (r.subs || []).map((s: any) => s.label).join(', ') || '—' },
            ]}
            rows={items.data || []}
            storeUrl="/super/bounty/categories"
            fields={[
                { name: 'label', label: 'Label', required: true },
                { name: 'description', label: 'Description', type: 'textarea' },
            ]}
        />
    );
}
