import { Head, router, usePage } from '@inertiajs/react';
import { RotateCw, Ban } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

interface Key { id: number; uuid: string; key_type: string; key_version: string; algorithm: string; status: string; project?: { name: string; uuid: string }; created_at: string; }
interface Project { id: number; name: string; uuid: string; }

export default function SecureDbKeys() {
    const { keys, projects } = usePage<{ keys: { data: Key[] }; projects: Project[] }>().props;

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Keys')}>
            <Head title="Secure DB — Keys" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Key Management</h1>
                    <div className="flex gap-2">
                        {projects.map(p => (
                            <button key={p.id} onClick={() => router.post(`/admin/secure-db/projects/${p.uuid}/rotate`)}
                                className="flex items-center gap-1 rounded-lg border border-sidebar-border/70 px-3 py-1.5 text-sm hover:bg-muted">
                                <RotateCw className="h-3.5 w-3.5" /> Rotate {p.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr>
                            {['Project', 'Type', 'Version', 'Algorithm', 'Status', 'Created', 'Actions'].map(h => (
                                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody className="divide-y divide-sidebar-border/40">
                            {keys.data.map(k => (
                                <tr key={k.id}>
                                    <td className="px-4 py-3">{k.project?.name}</td>
                                    <td className="px-4 py-3 capitalize">{k.key_type}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{k.key_version}</td>
                                    <td className="px-4 py-3">{k.algorithm}</td>
                                    <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs capitalize">{k.status}</span></td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs">{k.created_at}</td>
                                    <td className="px-4 py-3">
                                        {k.status === 'active' && (
                                            <button onClick={() => router.patch(`/admin/secure-db/keys/${k.uuid}/revoke`)} className="p-1 hover:text-destructive"><Ban className="h-4 w-4" /></button>
                                        )}
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
