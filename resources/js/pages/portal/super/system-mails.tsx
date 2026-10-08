import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="System Mail"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'System Mail', href: '/super/system-mails' }]}
            columns={[
                { key: 'key', label: 'Key' },
                { key: 'subject', label: 'Subject' },
                { key: 'is_active', label: 'Active', render: (r) => (r.is_active ? 'Yes' : 'No') },
            ]}
            rows={items.data || []}
            updateUrl={(r) => `/super/system-mails/${r.id}`}
            fields={[
                { name: 'subject', label: 'Subject', required: true },
                { name: 'body', label: 'Body', type: 'textarea' },
                { name: 'is_active', label: 'Active', type: 'checkbox' },
            ]}
        />
    );
}
