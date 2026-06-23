import { Head, router, usePage } from '@inertiajs/react';
import { Check, X, Ban } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

interface Device {
    id: number; uuid: string; device_name: string; fingerprint: string;
    operating_system: string | null; browser: string | null; ip_address: string | null;
    location: string | null; status: string; last_seen_at: string | null;
    project?: { name: string }; user?: { name: string };
}

export default function SecureDbDevices() {
    const { devices } = usePage<{ devices: { data: Device[] } }>().props;

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Devices')}>
            <Head title="Secure DB — Devices" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />
                <h1 className="text-xl font-bold">Authorized Devices</h1>

                <div className="rounded-xl border border-sidebar-border/70 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr>
                            {['Device', 'User', 'OS / Browser', 'IP', 'Status', 'Last Seen', 'Actions'].map(h => (
                                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody className="divide-y divide-sidebar-border/40">
                            {devices.data.map(d => (
                                <tr key={d.id}>
                                    <td className="px-4 py-3 font-medium">{d.device_name}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{d.user?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{d.operating_system} / {d.browser}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{d.ip_address}</td>
                                    <td className="px-4 py-3 capitalize"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">{d.status}</span></td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{d.last_seen_at ?? '—'}</td>
                                    <td className="px-4 py-3 flex gap-1">
                                        {d.status === 'pending' && <button onClick={() => router.patch(`/admin/secure-db/devices/${d.uuid}`, { status: 'approved' })} className="p-1 text-green-600"><Check className="h-4 w-4" /></button>}
                                        <button onClick={() => router.patch(`/admin/secure-db/devices/${d.uuid}`, { status: 'revoked' })} className="p-1 hover:text-yellow-600"><X className="h-4 w-4" /></button>
                                        <button onClick={() => router.patch(`/admin/secure-db/devices/${d.uuid}`, { status: 'blocked' })} className="p-1 hover:text-destructive"><Ban className="h-4 w-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
