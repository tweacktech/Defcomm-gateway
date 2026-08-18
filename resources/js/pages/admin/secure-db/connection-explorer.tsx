import { Head, Link, usePage } from '@inertiajs/react';
import {
    ChevronRight, ChevronDown, RefreshCw, Download, Search,
    Database, Table2, Eye, Lock, ArrowLeft,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

interface Connection {
    uuid: string; name: string; database_type: string; host: string; port: number;
    database_name: string; health_status: string; table_count: number;
    record_count_estimate: number; database_size_bytes: number | null;
    last_sync_at: string | null; connection_metadata: Record<string, unknown> | null;
}
interface SchemaTree {
    tables: Array<{ name: string; row_count: number; size_bytes?: number }>;
    views: string[];
    collections: Array<{ name: string; row_count: number }>;
    keys: Array<{ name: string; type: string }>;
    procedures: string[];
    functions: string[];
    triggers: string[];
}
interface PageProps {
    connection: Connection;
    project: { name: string } | null;
    widgets: Record<string, unknown>;
    schema_tree: SchemaTree;
}

export default function ConnectionExplorer() {
    const { connection, project, widgets, schema_tree } = usePage<PageProps>().props;
    const [tree, setTree] = useState(schema_tree);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({ tables: true, collections: true, keys: true });
    const [selected, setSelected] = useState<{ type: string; name: string } | null>(null);
    const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);
    const [browse, setBrowse] = useState<{ columns: string[]; rows: Record<string, unknown>[]; pagination: Record<string, number>; encryption?: Record<string, unknown> } | null>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [syncing, setSyncing] = useState(false);

    const base = `/admin/secure-db/connections/${connection.uuid}/api`;

    const loadObject = useCallback(async (type: string, name: string, p = 1) => {
        setSelected({ type, name });
        setLoading(true);
        try {
            const [metaRes, browseRes] = await Promise.all([
                axios.get(`${base}/objects/${encodeURIComponent(name)}/metadata`),
                axios.get(`${base}/objects/${encodeURIComponent(name)}/browse`, { params: { page: p, per_page: 50, search: search || undefined } }),
            ]);
            setMetadata(metaRes.data);
            setBrowse(browseRes.data);
            setPage(p);
        } finally {
            setLoading(false);
        }
    }, [base, search]);

    const syncSchema = async () => {
        setSyncing(true);
        try {
            await axios.post(`${base}/sync`);
            const { data } = await axios.get(`${base}/schema`);
            setTree(data.tree);
        } finally {
            setSyncing(false);
        }
    };

    const toggle = (key: string) => setExpanded(e => ({ ...e, [key]: !e[key] }));

    const isSql = ['mysql', 'mariadb', 'postgresql', 'sqlserver'].includes(connection.database_type);
    const isMongo = connection.database_type === 'mongodb';
    const isRedis = connection.database_type === 'redis';

    const breadcrumbs = [
        ...secureDbBreadcrumbs('Connections').slice(0, -1),
        { title: connection.name, href: '#' },
    ];

    const encryptedFields = (browse?.encryption as { encrypted_fields?: string[] })?.encrypted_fields ?? [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Explorer — ${connection.name}`} />
            <div className="flex flex-col gap-4 p-4 lg:p-6 h-[calc(100vh-4rem)]">
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Link href="/admin/secure-db/connections" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
                        <div>
                            <h1 className="text-lg font-bold flex items-center gap-2">
                                <Database className="h-5 w-5 text-primary" /> {connection.name}
                            </h1>
                            <p className="text-xs text-muted-foreground capitalize">{connection.database_type} · {connection.host}:{connection.port} · {project?.name}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={syncSchema} disabled={syncing}>
                            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sync
                        </Button>
                        {selected && (
                            <a href={`${base}/objects/${encodeURIComponent(selected.name)}/export`} className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                                <Download className="h-4 w-4 mr-1" /> Export
                            </a>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                    {[
                        ['Status', String(widgets.health_status ?? connection.health_status)],
                        ['Objects', String(connection.table_count)],
                        ['Records', Number(connection.record_count_estimate).toLocaleString()],
                        ['Last Sync', connection.last_sync_at ? new Date(connection.last_sync_at).toLocaleString() : 'Never'],
                    ].map(([l, v]) => (
                        <div key={l} className="rounded-lg border border-sidebar-border/70 bg-card px-3 py-2 text-sm">
                            <div className="text-muted-foreground text-xs">{l}</div>
                            <div className="font-medium capitalize">{v}</div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-1 min-h-0 gap-4">
                    {/* Sidebar tree */}
                    <aside className="w-64 shrink-0 rounded-xl border border-sidebar-border/70 bg-card overflow-y-auto p-3 text-sm">
                        {isSql && (
                            <TreeSection title="Tables" open={expanded.tables} onToggle={() => toggle('tables')} count={tree.tables?.length}>
                                {tree.tables?.map(t => (
                                    <button key={t.name} onClick={() => loadObject('table', t.name)}
                                        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-muted ${selected?.name === t.name ? 'bg-primary/10 text-primary' : ''}`}>
                                        <Table2 className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{t.name}</span>
                                        <span className="ml-auto text-xs text-muted-foreground">{t.row_count}</span>
                                    </button>
                                ))}
                            </TreeSection>
                        )}
                        {isMongo && (
                            <TreeSection title="Collections" open={expanded.collections} onToggle={() => toggle('collections')} count={tree.collections?.length}>
                                {tree.collections?.map(c => (
                                    <button key={c.name} onClick={() => loadObject('collection', c.name)}
                                        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-muted ${selected?.name === c.name ? 'bg-primary/10' : ''}`}>
                                        <span className="truncate">{c.name}</span>
                                    </button>
                                ))}
                            </TreeSection>
                        )}
                        {isRedis && (
                            <TreeSection title="Keys" open={expanded.keys} onToggle={() => toggle('keys')} count={tree.keys?.length}>
                                <button onClick={() => loadObject('key', '__all__')} className="flex w-full px-2 py-1 text-left text-primary hover:bg-muted text-xs">Browse all keys</button>
                                {tree.keys?.slice(0, 100).map(k => (
                                    <button key={k.name} onClick={() => loadObject('key', k.name)}
                                        className={`flex w-full items-center gap-1 rounded px-2 py-0.5 text-left hover:bg-muted font-mono text-xs ${selected?.name === k.name ? 'bg-primary/10' : ''}`}>
                                        <span className="truncate">{k.name}</span>
                                        <span className="text-muted-foreground ml-auto">{k.type}</span>
                                    </button>
                                ))}
                            </TreeSection>
                        )}
                        {isSql && tree.views?.length > 0 && (
                            <TreeSection title="Views" open={false} onToggle={() => toggle('views')} count={tree.views.length}>
                                {tree.views.map(v => <div key={v} className="px-2 py-0.5 text-muted-foreground truncate">{v}</div>)}
                            </TreeSection>
                        )}
                    </aside>

                    {/* Main panel */}
                    <main className="flex-1 flex flex-col min-w-0 rounded-xl border border-sidebar-border/70 bg-card overflow-hidden">
                        {!selected ? (
                            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
                                <Eye className="h-8 w-8 mb-2 opacity-30" />
                                <span>Select a table or collection from the sidebar</span>
                            </div>
                        ) : (
                            <>
                                <div className="border-b border-sidebar-border/70 p-4 shrink-0">
                                    <h2 className="font-semibold">{selected.name}</h2>
                                    {metadata && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {isSql && `Columns: ${(metadata.columns as unknown[])?.length ?? 0} · Rows: ${metadata.row_count ?? '—'}`}
                                            {isMongo && `Documents: ${metadata.document_count ?? '—'}`}
                                        </p>
                                    )}
                                    <div className="flex gap-2 mt-3">
                                        <div className="relative flex-1 max-w-xs">
                                            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input className="pl-8 h-8 text-sm" placeholder="Search..." value={search}
                                                onChange={e => setSearch(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && loadObject(selected.type, selected.name, 1)} />
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => loadObject(selected.type, selected.name, page)} disabled={loading}>Refresh</Button>
                                    </div>
                                </div>

                                {metadata && (metadata.columns as Array<Record<string, unknown>>)?.length > 0 && (
                                    <div className="border-b border-sidebar-border/40 p-3 overflow-x-auto shrink-0">
                                        <table className="w-full text-xs">
                                            <thead><tr className="text-muted-foreground">
                                                {['Column', 'Type', 'Nullable', 'PK', 'Encrypted'].map(h => <th key={h} className="text-left px-2 py-1">{h}</th>)}
                                            </tr></thead>
                                            <tbody>
                                                {(metadata.columns as Array<Record<string, unknown>>).map(col => (
                                                    <tr key={String(col.name)} className="border-t border-sidebar-border/30">
                                                        <td className="px-2 py-1 font-mono">{String(col.name)}</td>
                                                        <td className="px-2 py-1">{String(col.type)}</td>
                                                        <td className="px-2 py-1">{col.nullable ? 'YES' : 'NO'}</td>
                                                        <td className="px-2 py-1">{col.primary_key ? '✓' : ''}</td>
                                                        <td className="px-2 py-1">
                                                            {encryptedFields.includes(String(col.name)) && <Lock className="h-3 w-3 text-primary inline" />}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="flex-1 overflow-auto">
                                    {loading ? (
                                        <div className="p-8 text-center text-muted-foreground">Loading...</div>
                                    ) : browse ? (
                                        <table className="w-full text-xs">
                                            <thead className="bg-muted/50 sticky top-0">
                                                <tr>{browse.columns.map(c => (
                                                    <th key={c} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                                                        {c}
                                                        {encryptedFields.includes(c) && <Lock className="inline h-3 w-3 ml-1 text-primary" />}
                                                    </th>
                                                ))}</tr>
                                            </thead>
                                            <tbody>
                                                {browse.rows.map((row, i) => (
                                                    <tr key={i} className="border-t border-sidebar-border/30 hover:bg-muted/20">
                                                        {browse.columns.map(col => (
                                                            <td key={col} className="px-3 py-1.5 max-w-xs truncate font-mono">
                                                                {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : null}
                                </div>

                                {browse?.pagination && (
                                    <div className="border-t border-sidebar-border/70 p-3 flex items-center justify-between text-xs shrink-0">
                                        <span className="text-muted-foreground">
                                            Page {browse.pagination.current_page} of {browse.pagination.last_page} · {browse.pagination.total} total
                                        </span>
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => loadObject(selected.type, selected.name, page - 1)}>Prev</Button>
                                            <Button size="sm" variant="outline" disabled={page >= (browse.pagination.last_page ?? 1)} onClick={() => loadObject(selected.type, selected.name, page + 1)}>Next</Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </div>
            </div>
        </AppLayout>
    );
}

function TreeSection({ title, open, onToggle, count, children }: {
    title: string; open: boolean; onToggle: () => void; count?: number; children: React.ReactNode;
}) {
    return (
        <div className="mb-2">
            <button onClick={onToggle} className="flex w-full items-center gap-1 font-medium py-1 hover:text-primary">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {title}
                {count != null && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}
            </button>
            {open && <div className="ml-2 mt-0.5 space-y-0.5">{children}</div>}
        </div>
    );
}
