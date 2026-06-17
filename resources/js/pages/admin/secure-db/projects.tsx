import { Head, router, usePage } from '@inertiajs/react';
import { Plus, Pencil, Trash2, Archive, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

interface Project {
    id: number; uuid: string; name: string; description: string | null;
    status: string; environment: string; encryption_mode: string;
    rotation_interval: string; encrypted_records_count: number;
    owner?: { name: string }; created_at: string;
}

interface Paginator { data: Project[]; current_page: number; last_page: number; total: number; }
interface User { id: number; name: string; email: string; }

export default function SecureDbProjects() {
    const { projects, filters, users } = usePage<{ projects: Paginator; filters: Record<string, string>; users: User[] }>().props;
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', owner_id: '', status: 'active', environment: 'development', encryption_mode: 'field', rotation_interval: 'daily' });

    const submit = () => router.post('/admin/secure-db/projects', form, { preserveScroll: true, onSuccess: () => setShowForm(false) });

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Projects')}>
            <Head title="Secure DB — Projects" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Projects</h1>
                    <Button onClick={() => setShowForm(v => !v)} size="sm"><Plus className="h-4 w-4 mr-1" /> New Project</Button>
                </div>

                {showForm && (
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                            <div><Label>Owner</Label>
                                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.owner_id} onChange={e => setForm({ ...form, owner_id: e.target.value })}>
                                    <option value="">Select owner</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div><Label>Environment</Label>
                                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.environment} onChange={e => setForm({ ...form, environment: e.target.value })}>
                                    {['development', 'staging', 'production'].map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </div>
                            <div><Label>Encryption Mode</Label>
                                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.encryption_mode} onChange={e => setForm({ ...form, encryption_mode: e.target.value })}>
                                    {['field', 'row', 'collection', 'document'].map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                        <div><Label>Description</Label><textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                        <Button onClick={submit}>Create Project</Button>
                    </div>
                )}

                <div className="flex gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Search projects..." defaultValue={filters.search}
                            onKeyDown={e => e.key === 'Enter' && router.get('/admin/secure-db/projects', { search: (e.target as HTMLInputElement).value }, { preserveState: true })} />
                    </div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr>
                            {['Name', 'Owner', 'Status', 'Environment', 'Records', 'Actions'].map(h => (
                                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody className="divide-y divide-sidebar-border/40">
                            {projects.data.map(p => (
                                <tr key={p.id} className="hover:bg-muted/20">
                                    <td className="px-4 py-3 font-medium">{p.name}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{p.owner?.name ?? '—'}</td>
                                    <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs capitalize">{p.status}</span></td>
                                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.environment}</td>
                                    <td className="px-4 py-3">{p.encrypted_records_count.toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => router.patch(`/admin/secure-db/projects/${p.uuid}/archive`)} className="p-1 hover:text-primary" title="Archive"><Archive className="h-4 w-4" /></button>
                                            <button onClick={() => router.delete(`/admin/secure-db/projects/${p.uuid}`)} className="p-1 hover:text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
                                        </div>
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
