import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    FolderKanban, Database, Lock, RotateCw, MonitorSmartphone,
    AlertTriangle, Activity, Cpu, HardDrive,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { MiniChart, SecureDbNav, StatCard, secureDbBreadcrumbs } from './_shared';

interface PageProps {
    stats: {
        projects: number; active_projects: number; connections: number;
        healthy_connections: number; encrypted_records: number;
        rotations_today: number; active_devices: number; failed_attempts: number;
    };
    charts: Record<string, Record<string, number>>;
    monitoring: {
        cpu_load: { '1min': number };
        memory: { current_mb: number };
        queue: { pending_jobs: number; failed_jobs: number; status: string };
        database: { status: string };
        encryption_performance: { encryptions_last_hour: number };
    };
    recent_audit: Array<{ action: string; description: string; created_at: string; user?: { name: string } }>;
}

export default function SecureDbDashboard() {
    const { stats, charts, monitoring, recent_audit } = usePage<PageProps>().props;

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Dashboard')}>
            <Head title="Secure DB" />
            <div className="flex flex-col gap-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Secure DB</h1>
                        <p className="text-sm text-muted-foreground">Enterprise encryption middleware dashboard</p>
                    </div>
                    <Link href="/admin/secure-db/branding" className="text-sm text-primary hover:underline">
                        View branding →
                    </Link>
                </div>

                <SecureDbNav />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Projects" value={stats.projects} icon={FolderKanban} />
                    <StatCard label="Connections" value={`${stats.healthy_connections}/${stats.connections}`} icon={Database} />
                    <StatCard label="Encrypted Records" value={stats.encrypted_records.toLocaleString()} icon={Lock} />
                    <StatCard label="Rotations Today" value={stats.rotations_today} icon={RotateCw} />
                    <StatCard label="Active Devices" value={stats.active_devices} icon={MonitorSmartphone} />
                    <StatCard label="Failed Attempts" value={stats.failed_attempts} icon={AlertTriangle} accent="text-destructive" />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <MiniChart data={charts.encryption_activity ?? {}} label="Encryption Activity (7d)" color="bg-blue-500" />
                    <MiniChart data={charts.decryption_requests ?? {}} label="Decryption Requests (7d)" color="bg-green-500" />
                    <MiniChart data={charts.rotation_history ?? {}} label="Rotation History (30d)" color="bg-purple-500" />
                    <MiniChart data={charts.device_activity ?? {}} label="Device Activity (7d)" color="bg-orange-500" />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Cpu className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold">System Health</h3>
                        </div>
                        <dl className="space-y-2 text-sm">
                            <div className="flex justify-between"><dt className="text-muted-foreground">CPU Load</dt><dd>{monitoring.cpu_load['1min']}</dd></div>
                            <div className="flex justify-between"><dt className="text-muted-foreground">Memory</dt><dd>{monitoring.memory.current_mb} MB</dd></div>
                            <div className="flex justify-between"><dt className="text-muted-foreground">Queue</dt><dd>{monitoring.queue.status} ({monitoring.queue.pending_jobs} pending)</dd></div>
                            <div className="flex justify-between"><dt className="text-muted-foreground">Database</dt><dd className={monitoring.database.status === 'healthy' ? 'text-green-600' : 'text-destructive'}>{monitoring.database.status}</dd></div>
                        </dl>
                        <button onClick={() => router.post('/admin/secure-db/health-check')} className="mt-4 text-sm text-primary hover:underline">
                            Run health check
                        </button>
                    </div>

                    <div className="lg:col-span-2 rounded-xl border border-sidebar-border/70 bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Activity className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold">Recent Audit Events</h3>
                        </div>
                        <div className="divide-y divide-sidebar-border/40">
                            {recent_audit.length === 0 ? (
                                <p className="py-4 text-sm text-muted-foreground">No audit events yet</p>
                            ) : recent_audit.map((log, i) => (
                                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                                    <div>
                                        <span className="font-medium capitalize">{log.action.replace('_', ' ')}</span>
                                        <span className="mx-2 text-muted-foreground">—</span>
                                        <span className="text-muted-foreground">{log.description}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0 ml-4">{log.created_at}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
