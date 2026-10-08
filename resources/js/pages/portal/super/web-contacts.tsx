import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Web Contacts"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Contacts', href: '/super/support/contacts' }]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'subject', label: 'Subject' },
                { key: 'status', label: 'Status' },
            ]}
            rows={items.data || []}
            statusUrl={(r) => `/super/support/contacts/${r.id}`}
            statusActions={[
                { label: 'Read', value: 'read' },
                { label: 'Close', value: 'closed' },
            ]}
        />
    );
}
