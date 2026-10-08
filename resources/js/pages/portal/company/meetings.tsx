import PortalResourcePage from '@/components/portal-resource-page';
import { Link, usePage } from '@inertiajs/react';

export default function Page() {
    const { items } = usePage<{ items: { data: any[] } } & Record<string, unknown>>().props;
    return (
        <PortalResourcePage
            title="Meetings"
            breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Meetings', href: '/company/meetings' }]}
            columns={[
                { key: 'name', label: 'Name' },
                { key: 'uid', label: 'UID' },
                { key: 'status', label: 'Status' },
                { key: 'uid', label: 'Open', render: (r) => <Link className="text-primary underline" href={`/meet/${r.uid}`}>Join</Link> },
            ]}
            rows={items.data || []}
            extra={<p className="text-sm text-muted-foreground">Create meetings from <Link className="text-primary underline" href="/meet">Meet</Link>.</p>}
        />
    );
}
