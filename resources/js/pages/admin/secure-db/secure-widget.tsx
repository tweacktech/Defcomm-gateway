import { Head, router, usePage } from '@inertiajs/react';
import { Copy, Plus, Trash2, RefreshCw, Puzzle, Check, Eye, EyeOff, Database } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

interface Widget {
    uuid: string; name: string; widget_key: string; language: string;
    database_type: string; is_active: boolean; access_count: number;
    last_used_at: string | null;
    project?: { id: number; name: string };
}
interface Project { id: number; name: string; }
interface DbMarketItem { label: string; port: number; icon: string; }
interface WidgetCreated {
    uuid: string; name: string; widget_key: string; secret_key: string;
    database_type?: string;
    embed_code: { universal: string; snippet: string; language: string; gateway_url: string };
}
interface Flash { widget_created?: WidgetCreated; widget_secret?: Partial<WidgetCreated>; }

export default function SecureWidgetPage() {
    const { widgets, projects, languages, database_market, gateway_url, flash } = usePage<{
        widgets: { data: Widget[] };
        projects: Project[];
        languages: Record<string, string>;
        database_market: Record<string, DbMarketItem>;
        gateway_url: string;
        flash: Flash;
    }>().props;

    const [showForm, setShowForm] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [form, setForm] = useState({
        project_id: '', name: '', language: 'javascript', database_type: 'mysql', allowed_origins: '',
    });

    const created = flash?.widget_created ?? flash?.widget_secret;

    const copyText = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const submit = () => {
        router.post('/admin/secure-db/widgets', {
            ...form,
            allowed_origins: form.allowed_origins
                ? form.allowed_origins.split(',').map(s => s.trim()).filter(Boolean)
                : [],
        }, { onSuccess: () => setShowForm(false) });
    };

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Secure Widget')}>
            <Head title="Secure DB — Secure Widget" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Puzzle className="h-5 w-5 text-primary" /> Secure Widget
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Generate embeddable widgets — clients connect their own database from the widget after install.
                        </p>
                    </div>
                    <Button size="sm" onClick={() => setShowForm(v => !v)}>
                        <Plus className="h-4 w-4 mr-1" /> Generate Widget
                    </Button>
                </div>

                {created && (
                    <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-5 space-y-4">
                        <h2 className="font-semibold text-green-700 dark:text-green-400">Widget Created — Save Your Credentials</h2>
                        <p className="text-sm text-muted-foreground">
                            Share the secret key with your client. They enter it in the widget, then connect their own {created.database_type ?? 'database'} from their admin portal.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <Label className="text-xs">Widget Key (public)</Label>
                                <div className="flex gap-2 mt-1">
                                    <Input readOnly value={created.widget_key ?? ''} className="font-mono text-xs" />
                                    <Button size="icon" variant="outline" onClick={() => copyText(created.widget_key ?? '', 'wk')}>
                                        {copied === 'wk' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            {'secret_key' in created && created.secret_key && (
                                <div>
                                    <Label className="text-xs">Secret Key (private — save now)</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input readOnly type={showSecret ? 'text' : 'password'} value={created.secret_key} className="font-mono text-xs" />
                                        <Button size="icon" variant="outline" onClick={() => setShowSecret(v => !v)}>
                                            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                        <Button size="icon" variant="outline" onClick={() => copyText(created.secret_key!, 'sk')}>
                                            {copied === 'sk' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {created.embed_code && (
                            <div className="space-y-2">
                                <Label className="text-xs">Install Snippet ({created.embed_code.language})</Label>
                                <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto font-mono whitespace-pre-wrap">
                                    {created.embed_code.snippet || created.embed_code.universal}
                                </pre>
                                <Button size="sm" variant="outline" onClick={() => copyText(created.embed_code!.snippet || created.embed_code!.universal, 'embed')}>
                                    {copied === 'embed' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                                    Copy Embed Code
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {showForm && (
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 grid gap-4 sm:grid-cols-2">
                        <h2 className="sm:col-span-2 font-semibold">New Secure Widget</h2>
                        <div>
                            <Label>Project</Label>
                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                                <option value="">Select project</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div><Label>Widget Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Client Admin Portal" /></div>
                        <div>
                            <Label>Development Language</Label>
                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}>
                                {Object.entries(languages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <Label>Database Type (Market)</Label>
                            <p className="text-xs text-muted-foreground mb-2">Select the database your client will connect to from the widget. No credentials needed here.</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                {Object.entries(database_market).map(([key, db]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setForm({ ...form, database_type: key })}
                                        className={`rounded-lg border p-3 text-left transition-colors ${form.database_type === key ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-sidebar-border/70 hover:bg-muted/50'}`}
                                    >
                                        <Database className="h-4 w-4 mb-1 text-primary" />
                                        <div className="font-medium text-sm">{db.label}</div>
                                        <div className="text-xs text-muted-foreground">:{db.port}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="sm:col-span-2">
                            <Label>Allowed Origins (optional, comma-separated)</Label>
                            <Input value={form.allowed_origins} onChange={e => setForm({ ...form, allowed_origins: e.target.value })} placeholder="https://client-admin.com" />
                        </div>
                        <div className="sm:col-span-2 flex gap-2">
                            <Button onClick={submit} disabled={!form.project_id || !form.name}>Generate Widget & Secret Key</Button>
                            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                        </div>
                    </div>
                )}

                <div className="rounded-xl border border-sidebar-border/70 bg-card p-5">
                    <h3 className="font-medium mb-2">How it works</h3>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Pick a <strong>database type</strong> from the market and your client&apos;s <strong>dev language</strong>.</li>
                        <li>Copy the embed snippet into the client&apos;s admin portal.</li>
                        <li>Client opens the widget shield icon → enters the <strong>secret key</strong>.</li>
                        <li>Client connects <strong>their own database</strong> (host, credentials) directly in the widget.</li>
                        <li>From there: encrypt data, queue DB encryption, view audit logs, generate a private key.</li>
                    </ol>
                    <p className="text-xs text-muted-foreground mt-3">Gateway URL: <code className="font-mono">{gateway_url}</code></p>
                </div>

                <div className="rounded-xl border border-sidebar-border/70 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr>
                            {['Name', 'Language', 'DB Type', 'Key', 'Status', 'Uses', 'Actions'].map(h => (
                                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody className="divide-y divide-sidebar-border/40">
                            {widgets.data.map(w => (
                                <tr key={w.uuid} className="hover:bg-muted/20">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{w.name}</div>
                                        <div className="text-xs text-muted-foreground">{w.project?.name}</div>
                                    </td>
                                    <td className="px-4 py-3 capitalize">{w.language}</td>
                                    <td className="px-4 py-3 capitalize">{database_market[w.database_type]?.label ?? w.database_type}</td>
                                    <td className="px-4 py-3 font-mono text-xs">{w.widget_key.slice(0, 16)}…</td>
                                    <td className="px-4 py-3">
                                        <span className={w.is_active ? 'text-green-600' : 'text-muted-foreground'}>{w.is_active ? 'Active' : 'Inactive'}</span>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{w.access_count}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button title="Copy widget key" onClick={() => copyText(w.widget_key, w.uuid)} className="p-1 hover:text-primary">
                                                {copied === w.uuid ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            </button>
                                            <button title="Regenerate secret" onClick={() => router.post(`/admin/secure-db/widgets/${w.uuid}/regenerate-secret`)} className="p-1 hover:text-primary">
                                                <RefreshCw className="h-4 w-4" />
                                            </button>
                                            <button title="Toggle active" onClick={() => router.patch(`/admin/secure-db/widgets/${w.uuid}/toggle`)} className="p-1 hover:text-primary">
                                                <Puzzle className="h-4 w-4" />
                                            </button>
                                            <button title="Delete" onClick={() => router.delete(`/admin/secure-db/widgets/${w.uuid}`)} className="p-1 hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {widgets.data.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No widgets yet. Generate your first embeddable widget.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppLayout>
    );
}
