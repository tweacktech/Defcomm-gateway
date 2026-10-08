import { Head, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';

export default function Page() {
    const { contacts, directory } = usePage<{ contacts: any[]; directory: any[] } & Record<string, unknown>>().props;
    const linked = new Set(contacts.map((c) => c.user_link));

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Contacts', href: '/app/contacts' }]}>
            <Head title="Contacts" />
            <div className="flex flex-col gap-6 p-6">
                <h1 className="text-2xl font-bold">Contacts</h1>
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border bg-card overflow-hidden">
                        <div className="border-b p-4 font-semibold">My contacts</div>
                        <table className="w-full text-sm">
                            <tbody>
                                {contacts.map((c) => (
                                    <tr key={c.id} className="border-b">
                                        <td className="px-4 py-3">{c.contact?.name}<div className="text-xs text-muted-foreground">{c.contact?.email}</div></td>
                                        <td className="px-4 py-3 text-right"><Button size="sm" variant="destructive" onClick={() => router.delete(`/app/contacts/${c.id}`)}>Remove</Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="rounded-xl border bg-card overflow-hidden">
                        <div className="border-b p-4 font-semibold">Directory</div>
                        <table className="w-full text-sm">
                            <tbody>
                                {directory.map((u) => (
                                    <tr key={u.id} className="border-b">
                                        <td className="px-4 py-3">{u.name}<div className="text-xs text-muted-foreground">{u.email}</div></td>
                                        <td className="px-4 py-3 text-right">
                                            {linked.has(u.id) ? <span className="text-xs text-muted-foreground">Added</span> : (
                                                <Button size="sm" onClick={() => router.post(`/app/contacts/${u.id}`)}>Add</Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
