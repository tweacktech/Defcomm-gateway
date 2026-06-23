import { Head, router, usePage } from '@inertiajs/react';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

interface Connection {
    id: number; uuid: string; name: string; database_type: string;
    host: string; port: number; database_name: string; health_status: string;
    project?: { name: string };
}
interface Project { id: number; name: string; }

export default function SecureDbConnections() {
    const { connections, projects } = usePage<{ connections: { data: Connection[] }; projects: Project[] }>().props;
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ project_id: '', name: '', database_type: 'mysql', host: '127.0.0.1', port: '3306', database_name: '', username: '', password: '', ssl_enabled: false });

    const statusColor = (s: string) => s === 'healthy' ? 'text-green-600' : s === 'unhealthy' ? 'text-destructive' : 'text-yellow-600';

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Connections')}>
            <Head title="Secure DB — Connections" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Database Connections</h1>
                    <Button size="sm" onClick={() => setShowForm(v => !v)}><Plus className="h-4 w-4 mr-1" /> Add Connection</Button>
                </div>

                {showForm && (
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 grid gap-4 sm:grid-cols-2">
                        <div><Label>Project</Label>
                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                                <option value="">Select project</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                        <div><Label>Type</Label>
                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.database_type} onChange={e => setForm({ ...form, database_type: e.target.value })}>
                                {['mysql', 'mariadb', 'postgresql', 'sqlserver', 'mongodb', 'redis'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div><Label>Host</Label><Input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} /></div>
                        <div><Label>Port</Label><Input value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} /></div>
                        <div><Label>Database</Label><Input value={form.database_name} onChange={e => setForm({ ...form, database_name: e.target.value })} /></div>
                        <div><Label>Username</Label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
                        <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
                        <div className="sm:col-span-2"><Button onClick={() => router.post('/admin/secure-db/connections', form, { onSuccess: () => setShowForm(false) })}>Save Connection</Button></div>
                    </div>
                )}

                <div className="rounded-xl border border-sidebar-border/70 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr>
                            {['Name', 'Project', 'Type', 'Host', 'Health', 'Actions'].map(h => (
                                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody className="divide-y divide-sidebar-border/40">
                            {connections.data.map(c => (
                                <tr key={c.id}>
                                    <td className="px-4 py-3 font-medium">{c.name}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{c.project?.name}</td>
                                    <td className="px-4 py-3 capitalize">{c.database_type}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{c.host}:{c.port}</td>
                                    <td className={`px-4 py-3 capitalize font-medium ${statusColor(c.health_status)}`}>{c.health_status}</td>
                                    <td className="px-4 py-3 flex gap-1">
                                        <button onClick={() => router.post(`/admin/secure-db/connections/${c.uuid}/test`)} className="p-1 hover:text-primary"><RefreshCw className="h-4 w-4" /></button>
                                        <button onClick={() => router.delete(`/admin/secure-db/connections/${c.uuid}`)} className="p-1 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
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
