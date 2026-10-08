import PortalResourcePage from '@/components/portal-resource-page';
import { Link, usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Company Files"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Files', href: '/company/files' }]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'visibility', label: 'Visibility' },
                { key: 'owner', label: 'Owner', render: (r) => r.owner?.email || '—' },
                { key: 'size', label: 'Size' },
            ]}
            rows={items.data || []}
            extra={<p className="text-sm text-muted-foreground">For full file tools use <Link className="text-primary underline" href="/services/drive">Drive</Link> or Files API.</p>}
        />
    );
}
