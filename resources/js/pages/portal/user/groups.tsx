import { Head, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';

export default function Page() {
    const { joined, pending } = usePage<{ joined: any[]; pending: any[] } & Record<string, unknown>>().props;

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Groups', href: '/app/groups' }]}>
            <Head title="Groups" />
            <div className="flex flex-col gap-6 p-6">
                <h1 className="text-2xl font-bold">Groups</h1>
                <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="border-b p-4 font-semibold">Joined</div>
                    <table className="w-full text-sm">
                        <tbody>
                            {joined.map((m) => (
                                <tr key={m.id} className="border-b"><td className="px-4 py-3">{m.group?.name}</td><td className="px-4 py-3 text-muted-foreground">{m.status}</td></tr>
                            ))}
                            {joined.length === 0 && <tr><td className="px-4 py-6 text-muted-foreground">No groups yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="border-b p-4 font-semibold">Pending invitations</div>
                    <table className="w-full text-sm">
                        <tbody>
                            {pending.map((m) => (
                                <tr key={m.id} className="border-b">
                                    <td className="px-4 py-3">{m.group?.name}</td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <Button size="sm" onClick={() => router.post(`/app/groups/${m.id}/accept`)}>Accept</Button>
                                        <Button size="sm" variant="outline" onClick={() => router.post(`/app/groups/${m.id}/decline`)}>Decline</Button>
                                    </td>
                                </tr>
                            ))}
                            {pending.length === 0 && <tr><td className="px-4 py-6 text-muted-foreground">No invitations.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
