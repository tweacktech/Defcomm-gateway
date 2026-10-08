import PortalResourcePage from '@/components/portal-resource-page';
import { usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Web Bookings"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Bookings', href: '/super/support/bookings' }]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'company', label: 'Company' },
                { key: 'status', label: 'Status' },
            ]}
            rows={items.data || []}
            statusUrl={(r) => `/super/support/bookings/${r.id}`}
            statusActions={[
                { label: 'Schedule', value: 'scheduled' },
                { label: 'Close', value: 'closed' },
            ]}
        />
    );
}
