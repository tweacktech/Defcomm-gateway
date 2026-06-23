import { Head, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

export default function SecureDbPolicies() {
    const { policies, projects } = usePage<{ policies: { data: Array<Record<string, unknown>> }; projects: Array<{ id: number; name: string }> }>().props;
    const [form, setForm] = useState({ project_id: '', name: '', scope: 'field', target_table: '', sensitive_fields: '', algorithm: 'aes-256-gcm', is_active: true });

    const submit = () => router.post('/admin/secure-db/policies', {
        ...form,
        sensitive_fields: form.sensitive_fields.split(',').map(s => s.trim()).filter(Boolean),
    });

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Policies')}>
            <Head title="Secure DB — Policies" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />
                <h1 className="text-xl font-bold">Encryption Policies</h1>

                <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 grid gap-4 sm:grid-cols-2">
                    <div><Label>Project</Label>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                            <option value="">Select</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                    <div><Label>Scope</Label>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}>
                            {['field', 'row', 'collection', 'document'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div><Label>Target Table</Label><Input value={form.target_table} onChange={e => setForm({ ...form, target_table: e.target.value })} /></div>
                    <div className="sm:col-span-2"><Label>Sensitive Fields (comma-separated)</Label><Input value={form.sensitive_fields} onChange={e => setForm({ ...form, sensitive_fields: e.target.value })} placeholder="email, ssn, phone" /></div>
                    <div><Button onClick={submit}><Plus className="h-4 w-4 mr-1" /> Add Policy</Button></div>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr>
                            {['Name', 'Scope', 'Table', 'Algorithm', 'Active'].map(h => <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>)}
                        </tr></thead>
                        <tbody className="divide-y divide-sidebar-border/40">
                            {policies.data.map((p: Record<string, unknown>) => (
                                <tr key={p.id as number}>
                                    <td className="px-4 py-3 font-medium">{p.name as string}</td>
                                    <td className="px-4 py-3 capitalize">{p.scope as string}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{(p.target_table as string) || '—'}</td>
                                    <td className="px-4 py-3">{p.algorithm as string}</td>
                                    <td className="px-4 py-3">{p.is_active ? '✓' : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
