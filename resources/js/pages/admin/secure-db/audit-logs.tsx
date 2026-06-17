import { Head, router, usePage } from '@inertiajs/react';
import { Download } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

interface AuditLog {
    id: number; action: string; description: string; ip_address: string | null;
    success: boolean; created_at: string; user?: { name: string }; project?: { name: string };
}

export default function SecureDbAuditLogs() {
    const { logs } = usePage<{ logs: { data: AuditLog[] } }>().props;

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Audit Logs')}>
            <Head title="Secure DB — Audit Logs" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Audit Logs</h1>
                    <div className="flex gap-2">
                        {['csv', 'excel', 'pdf'].map(fmt => (
                            <a key={fmt} href={`/admin/secure-db/audit-logs/export/${fmt}`}
                                className="flex items-center gap-1 rounded-lg border border-sidebar-border/70 px-3 py-1.5 text-sm hover:bg-muted uppercase">
                                <Download className="h-3.5 w-3.5" /> {fmt}
                            </a>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr>
                            {['Action', 'Description', 'User', 'IP', 'Success', 'Time'].map(h => (
                                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody className="divide-y divide-sidebar-border/40">
                            {logs.data.map(log => (
                                <tr key={log.id}>
                                    <td className="px-4 py-3 capitalize font-medium">{log.action.replace('_', ' ')}</td>
                                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{log.description}</td>
                                    <td className="px-4 py-3">{log.user?.name ?? 'System'}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{log.ip_address}</td>
                                    <td className="px-4 py-3">{log.success ? <span className="text-green-600">✓</span> : <span className="text-destructive">✗</span>}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{log.created_at}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
