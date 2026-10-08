import PortalResourcePage from '@/components/portal-resource-page';
import { Link, usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="My Files"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Files', href: '/app/files' }]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'visibility', label: 'Visibility' },
                { key: 'size', label: 'Size' },
            ]}
            rows={items.data || []}
            extra={<p className="text-sm text-muted-foreground">Upload and manage files in <Link className="text-primary underline" href="/services/drive">Drive</Link>.</p>}
        />
    );
}
