import { Head, router } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

export type Field = {
    name: string;
    label: string;
    type?: 'text' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox';
    options?: { value: string; label: string }[];
    required?: boolean;
};

type Props = {
    title: string;
    breadcrumbs: BreadcrumbItem[];
    columns: { key: string; label: string; render?: (row: any) => ReactNode }[];
    rows: any[];
    storeUrl?: string;
    updateUrl?: (row: any) => string;
    deleteUrl?: (row: any) => string;
    fields?: Field[];
    statusActions?: { label: string; value: string; field?: string }[];
    statusUrl?: (row: any) => string;
    extra?: ReactNode;
};

export default function PortalResourcePage({
    title,
    breadcrumbs,
    columns,
    rows,
    storeUrl,
    updateUrl,
    deleteUrl,
    fields = [],
    statusActions = [],
    statusUrl,
    extra,
}: Props) {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<any | null>(null);
    const [form, setForm] = useState<Record<string, any>>({});
    const [saving, setSaving] = useState(false);

    const startCreate = () => {
        setEditing(null);
        const initial: Record<string, any> = {};
        fields.forEach((f) => {
            initial[f.name] = f.type === 'checkbox' ? true : '';
        });
        setForm(initial);
        setOpen(true);
    };

    const startEdit = (row: any) => {
        setEditing(row);
        const initial: Record<string, any> = {};
        fields.forEach((f) => {
            initial[f.name] = row[f.name] ?? (f.type === 'checkbox' ? false : '');
        });
        setForm(initial);
        setOpen(true);
    };

    const submit = () => {
        if (!storeUrl && !editing) return;
        setSaving(true);
        const opts = {
            preserveScroll: true,
            onFinish: () => setSaving(false),
            onSuccess: () => setOpen(false),
        };
        if (editing && updateUrl) {
            router.patch(updateUrl(editing), form, opts);
        } else if (storeUrl) {
            router.post(storeUrl, form, opts);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={title} />
            <div className="flex flex-col gap-6 p-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                        <p className="text-sm text-muted-foreground">Manage {title.toLowerCase()} from the gateway portal.</p>
                    </div>
                    {storeUrl && fields.length > 0 && (
                        <Button onClick={startCreate} className="gap-2">
                            <Plus className="h-4 w-4" /> Add
                        </Button>
                    )}
                </div>

                {extra}

                <div className="overflow-hidden rounded-xl border bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b bg-muted/40 text-left">
                                <tr>
                                    {columns.map((c) => (
                                        <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>
                                    ))}
                                    <th className="px-4 py-3 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                                            No records yet.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row) => (
                                    <tr key={row.id ?? JSON.stringify(row)} className="border-b last:border-0">
                                        {columns.map((c) => (
                                            <td key={c.key} className="px-4 py-3 align-top">
                                                {c.render ? c.render(row) : String(row[c.key] ?? '')}
                                            </td>
                                        ))}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                                {updateUrl && fields.length > 0 && (
                                                    <Button size="sm" variant="outline" onClick={() => startEdit(row)}>Edit</Button>
                                                )}
                                                {statusUrl && statusActions.map((a) => (
                                                    <Button
                                                        key={a.value}
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => router.patch(statusUrl(row), { [a.field || 'status']: a.value }, { preserveScroll: true })}
                                                    >
                                                        {a.label}
                                                    </Button>
                                                ))}
                                                {deleteUrl && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => {
                                                            if (confirm('Delete this record?')) {
                                                                router.delete(deleteUrl(row), { preserveScroll: true });
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
                    <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-card shadow-2xl">
                        <div className="border-b p-4 font-semibold">{editing ? 'Edit' : 'Create'} {title}</div>
                        <div className="flex-1 space-y-4 overflow-y-auto p-4">
                            {fields.map((f) => (
                                <div key={f.name} className="space-y-1">
                                    <Label className="text-xs">{f.label}</Label>
                                    {f.type === 'textarea' ? (
                                        <textarea
                                            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                                            value={form[f.name] ?? ''}
                                            onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                                        />
                                    ) : f.type === 'select' ? (
                                        <select
                                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                                            value={form[f.name] ?? ''}
                                            onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                                        >
                                            {(f.options || []).map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    ) : f.type === 'checkbox' ? (
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={!!form[f.name]}
                                                onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
                                            />
                                            Active
                                        </label>
                                    ) : (
                                        <Input
                                            type={f.type || 'text'}
                                            value={form[f.name] ?? ''}
                                            onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 border-t p-4">
                            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button className="flex-1" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save'}</Button>
                        </div>
                    </div>
                </>
            )}
        </AppLayout>
    );
}
