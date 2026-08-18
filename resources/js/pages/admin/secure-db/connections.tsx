import { Head, Link, router, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    Plus, Trash2, RefreshCw, Database, CheckCircle2, XCircle,
    ExternalLink, Table2, HardDrive, Pencil, X, AlertCircle, Lock, Shield,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, StatCard, secureDbBreadcrumbs } from './_shared';

interface Connection {
    id: number; uuid: string; name: string; database_type: string;
    host: string; port: number; database_name: string; health_status: string;
    table_count: number; record_count_estimate: number; database_size_bytes: number | null;
    last_sync_at: string | null; project_id: number;
    ssl_enabled: boolean; connection_timeout: number; charset: string | null;
    collation: string | null; redis_database: number;
    project?: { id: number; name: string };
}
interface Project { id: number; name: string; }
interface Summary { total: number; online: number; offline: number; tables: number; records: number; }
interface Flash {
    success?: string;
    error?: string;
    connection_test?: Record<string, unknown>;
}
interface EncryptColumn { name: string; type: string; }
interface EncryptTable { name: string; row_count: number | null; columns: EncryptColumn[]; }
interface EncryptJob {
    uuid: string; status: string; error_message: string | null;
    payload: { scope?: string; algorithm?: string; table?: string; fields?: string[] };
    result: { processed?: number; tables?: number; fields?: string[] } | null;
    started_at: string | null; completed_at: string | null;
}

function ConnectionResult({ result }: { result: Record<string, unknown> }) {
    const success = Boolean(result.success);

    return (
        <div className={`rounded-lg border p-4 text-sm ${success ? 'border-green-500/40 bg-green-500/10' : 'border-destructive/40 bg-destructive/10'}`}>
            <div className="flex items-start gap-2">
                {success
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    : <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                    <p className="font-medium">{success ? 'Connection successful' : 'Connection failed'}</p>
                    {result.message != null && (
                        <p className={`mt-1 ${success ? 'text-muted-foreground' : 'text-destructive'}`}>
                            {String(result.message)}
                        </p>
                    )}
                    {success && (
                        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            {['driver', 'server_version', 'ping_ms', 'current_database', 'character_encoding'].map(k => result[k] != null && (
                                <div key={k}>
                                    <dt className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</dt>
                                    <dd className="font-mono">{String(result[k])}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
            </div>
        </div>
    );
}

const PORTS: Record<string, string> = {
    mysql: '3306', mariadb: '3306', postgresql: '5432', sqlserver: '1433', mongodb: '27017', redis: '6379',
};

const emptyForm = () => ({
    project_id: '', name: '', database_type: 'mysql', host: '127.0.0.1',
    port: '3306', database_name: '', username: '', password: '',
    ssl_enabled: false, connection_timeout: '10', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci', redis_database: '0',
});

export default function SecureDbConnections() {
    const { connections, projects, summary, errors, algorithms } = usePage<{
        connections: { data: Connection[] }; projects: Project[]; summary: Summary;
        flash: Flash; errors: Record<string, string>;
        algorithms: Record<string, string>;
    }>().props;

    const [showForm, setShowForm] = useState(false);
    const [editingUuid, setEditingUuid] = useState<string | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);

    const [encryptConnUuid, setEncryptConnUuid] = useState('');
    const [encryptScope, setEncryptScope] = useState<'database' | 'table' | 'field'>('database');
    const [encryptAlgorithm, setEncryptAlgorithm] = useState('aes-256-gcm');
    const [encryptTable, setEncryptTable] = useState('');
    const [encryptFields, setEncryptFields] = useState<string[]>([]);
    const [encryptTables, setEncryptTables] = useState<EncryptTable[]>([]);
    const [encryptSupports, setEncryptSupports] = useState(true);
    const [encrypting, setEncrypting] = useState(false);
    const [encryptMessage, setEncryptMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [encryptJobs, setEncryptJobs] = useState<EncryptJob[]>([]);

    const algorithmOptions = Object.entries(algorithms ?? {
        'aes-256-gcm': 'AES-256-GCM',
        'chacha20-poly1305': 'ChaCha20-Poly1305',
        'rsa-4096-hybrid': 'RSA-4096 Hybrid',
    });

    const loadEncryptionTargets = useCallback(async (uuid: string) => {
        if (!uuid) {
            setEncryptTables([]);
            return;
        }
        try {
            const { data } = await axios.get(`/admin/secure-db/connections/${uuid}/api/encryption-targets`);
            setEncryptTables(data.tables ?? []);
            setEncryptSupports(Boolean(data.supports_encryption));
            if (data.algorithms && Object.keys(data.algorithms).length > 0) {
                setEncryptAlgorithm(Object.keys(data.algorithms)[0]);
            }
        } catch {
            setEncryptTables([]);
            setEncryptSupports(false);
        }
    }, []);

    const loadEncryptionJobs = useCallback(async (uuid: string) => {
        if (!uuid) {
            setEncryptJobs([]);
            return;
        }
        try {
            const { data } = await axios.get(`/admin/secure-db/connections/${uuid}/api/encryption-jobs`);
            setEncryptJobs(data.jobs ?? []);
        } catch {
            setEncryptJobs([]);
        }
    }, []);

    useEffect(() => {
        if (!encryptConnUuid) return;
        loadEncryptionTargets(encryptConnUuid);
        loadEncryptionJobs(encryptConnUuid);
    }, [encryptConnUuid, loadEncryptionTargets, loadEncryptionJobs]);

    useEffect(() => {
        const hasRunning = encryptJobs.some(j => j.status === 'pending' || j.status === 'running');
        if (!encryptConnUuid || !hasRunning) return;
        const timer = setInterval(() => loadEncryptionJobs(encryptConnUuid), 5000);
        return () => clearInterval(timer);
    }, [encryptConnUuid, encryptJobs, loadEncryptionJobs]);

    const selectedTableColumns = encryptTables.find(t => t.name === encryptTable)?.columns ?? [];

    const toggleEncryptField = (field: string) => {
        setEncryptFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]);
    };

    const runEncryption = async () => {
        if (!encryptConnUuid) {
            setEncryptMessage({ type: 'error', text: 'Select a connection first.' });
            return;
        }
        if (encryptScope === 'table' && !encryptTable) {
            setEncryptMessage({ type: 'error', text: 'Select a table to encrypt.' });
            return;
        }
        if (encryptScope === 'field' && (!encryptTable || encryptFields.length === 0)) {
            setEncryptMessage({ type: 'error', text: 'Select a table and at least one field.' });
            return;
        }

        setEncrypting(true);
        setEncryptMessage(null);
        try {
            const { data } = await axios.post(`/admin/secure-db/connections/${encryptConnUuid}/api/encrypt`, {
                scope: encryptScope,
                algorithm: encryptAlgorithm,
                table_name: encryptScope === 'database' ? null : encryptTable,
                fields: encryptScope === 'field' ? encryptFields : [],
            });
            setEncryptMessage({ type: 'success', text: data.message ?? 'Encryption queued.' });
            loadEncryptionJobs(encryptConnUuid);
        } catch (err) {
            const text = axios.isAxiosError(err)
                ? (err.response?.data as { message?: string })?.message ?? 'Failed to queue encryption.'
                : 'Failed to queue encryption.';
            setEncryptMessage({ type: 'error', text });
        } finally {
            setEncrypting(false);
        }
    };

    const statusColor = (s: string) => s === 'healthy' ? 'text-green-600' : s === 'unhealthy' ? 'text-destructive' : 'text-yellow-600';
    const fmtBytes = (b: number | null) => !b ? '—' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
    const isEditing = editingUuid !== null;

    const onTypeChange = (type: string) => {
        setForm(f => ({ ...f, database_type: type, port: PORTS[type] ?? '3306' }));
    };

    const openCreate = () => {
        setEditingUuid(null);
        setForm(emptyForm());
        setShowForm(true);
        setTestResult(null);
    };

    const openEdit = (c: Connection) => {
        setEditingUuid(c.uuid);
        setForm({
            project_id: String(c.project_id),
            name: c.name,
            database_type: c.database_type,
            host: c.host,
            port: String(c.port),
            database_name: c.database_name,
            username: '',
            password: '',
            ssl_enabled: c.ssl_enabled,
            connection_timeout: String(c.connection_timeout ?? 10),
            charset: c.charset ?? 'utf8mb4',
            collation: c.collation ?? 'utf8mb4_unicode_ci',
            redis_database: String(c.redis_database ?? 0),
        });
        setShowForm(true);
        setTestResult(null);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingUuid(null);
        setForm(emptyForm());
    };

    const submitForm = () => {
        const payload = {
            ...form,
            ssl_enabled: form.ssl_enabled,
            port: Number(form.port),
            connection_timeout: Number(form.connection_timeout),
            redis_database: Number(form.redis_database),
        };

        const options = {
            preserveState: true,
            onStart: () => {
                setSaving(true);
                setTestResult(null);
            },
            onFinish: () => setSaving(false),
            onSuccess: (page) => {
                const test = (page.props as { flash?: Flash }).flash?.connection_test;
                if (test) {
                    setTestResult(test);
                    if (!test.success) {
                        return;
                    }
                }
                closeForm();
            },
        };

        if (isEditing) {
            router.patch(`/admin/secure-db/connections/${editingUuid}`, payload, options);
        } else {
            router.post('/admin/secure-db/connections', payload, options);
        }
    };

    const runTest = async (uuid: string) => {
        setTesting(uuid);
        setTestResult(null);
        try {
            const { data } = await axios.post(`/admin/secure-db/connections/${uuid}/api/test`);
            setTestResult(data);
        } catch (err) {
            const message = axios.isAxiosError(err)
                ? (err.response?.data as { message?: string })?.message ?? 'Test request failed.'
                : 'Test request failed.';
            setTestResult({ success: false, message });
        } finally {
            setTesting(null);
        }
    };

    const validationErrors = Object.values(errors ?? {});

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Connections')}>
            <Head title="Secure DB — Connections" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />

                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">Database Connections</h1>
                    <Button size="sm" onClick={() => showForm && !isEditing ? closeForm() : openCreate()}>
                        <Plus className="h-4 w-4 mr-1" /> Add Connection
                    </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard label="Connected" value={summary.total} icon={Database} />
                    <StatCard label="Online" value={summary.online} icon={CheckCircle2} accent="text-green-600" />
                    <StatCard label="Offline" value={summary.offline} icon={XCircle} accent="text-destructive" />
                    <StatCard label="Tables / Collections" value={summary.tables} icon={Table2} />
                    <StatCard label="Est. Records" value={summary.records.toLocaleString()} icon={HardDrive} />
                </div>

                {showForm && (
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2 flex items-center justify-between">
                            <h2 className="font-semibold">{isEditing ? 'Edit Connection' : 'New Connection'}</h2>
                            <button type="button" onClick={closeForm} className="p-1 text-muted-foreground hover:text-foreground" title="Close">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {validationErrors.length > 0 && (
                            <div className="sm:col-span-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
                                {validationErrors.map((msg, i) => <p key={i}>{msg}</p>)}
                            </div>
                        )}
                        {testResult && (
                            <div className="sm:col-span-2">
                                <ConnectionResult result={testResult} />
                            </div>
                        )}
                        <div><Label>Project</Label>
                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                                <option value="">Select project</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                        <div><Label>Type</Label>
                            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.database_type} onChange={e => onTypeChange(e.target.value)}>
                                {['mysql', 'mariadb', 'postgresql', 'sqlserver', 'mongodb', 'redis'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div><Label>Host</Label><Input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} /></div>
                        <div><Label>Port</Label><Input value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} /></div>
                        {form.database_type !== 'redis' && (
                            <div><Label>Database</Label><Input value={form.database_name} onChange={e => setForm({ ...form, database_name: e.target.value })} /></div>
                        )}
                        {form.database_type === 'redis' && (
                            <div><Label>Redis DB Index (0-15)</Label><Input value={form.redis_database} onChange={e => setForm({ ...form, redis_database: e.target.value })} /></div>
                        )}
                        <div>
                            <Label>Username{isEditing && <span className="text-muted-foreground font-normal"> (leave blank to keep)</span>}</Label>
                            <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder={isEditing ? 'Unchanged' : ''} />
                        </div>
                        <div>
                            <Label>Password{isEditing && <span className="text-muted-foreground font-normal"> (leave blank to keep)</span>}</Label>
                            <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={isEditing ? 'Unchanged' : ''} />
                        </div>
                        <div><Label>Timeout (sec)</Label><Input type="number" value={form.connection_timeout} onChange={e => setForm({ ...form, connection_timeout: e.target.value })} /></div>
                        {['mysql', 'mariadb'].includes(form.database_type) && (
                            <>
                                <div><Label>Charset</Label><Input value={form.charset} onChange={e => setForm({ ...form, charset: e.target.value })} /></div>
                                <div><Label>Collation</Label><Input value={form.collation} onChange={e => setForm({ ...form, collation: e.target.value })} /></div>
                            </>
                        )}
                        <div className="flex items-center gap-2 sm:col-span-2">
                            <input type="checkbox" id="ssl" checked={form.ssl_enabled} onChange={e => setForm({ ...form, ssl_enabled: e.target.checked })} />
                            <Label htmlFor="ssl">SSL Enabled</Label>
                        </div>
                        <div className="sm:col-span-2 flex gap-2">
                            <Button onClick={submitForm} disabled={saving}>
                                {saving && <Spinner className="mr-2" />}
                                {saving
                                    ? (isEditing ? 'Updating…' : 'Saving…')
                                    : (isEditing ? 'Update & Test Connection' : 'Save & Test Connection')}
                            </Button>
                            <Button variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
                        </div>
                    </div>
                )}

                {testResult && !showForm && (
                    <ConnectionResult result={testResult} />
                )}

                <div className="rounded-xl border border-sidebar-border/70 bg-card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold">Database Encryption</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Encrypt data in the background. You will receive an email when the job completes.
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="sm:col-span-2">
                            <Label>Connection</Label>
                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                                value={encryptConnUuid}
                                onChange={e => {
                                    setEncryptConnUuid(e.target.value);
                                    setEncryptTable('');
                                    setEncryptFields([]);
                                    setEncryptMessage(null);
                                }}
                            >
                                <option value="">Select connection</option>
                                {connections.data.map(c => (
                                    <option key={c.uuid} value={c.uuid}>
                                        {c.name} ({c.database_type}) — {c.health_status}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label>Encryption Type</Label>
                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                                value={encryptAlgorithm}
                                onChange={e => setEncryptAlgorithm(e.target.value)}
                            >
                                {algorithmOptions.map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Label>Scope</Label>
                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                                value={encryptScope}
                                onChange={e => {
                                    setEncryptScope(e.target.value as 'database' | 'table' | 'field');
                                    setEncryptTable('');
                                    setEncryptFields([]);
                                }}
                            >
                                <option value="database">Whole Database</option>
                                <option value="table">Single Table</option>
                                <option value="field">Specific Field(s)</option>
                            </select>
                        </div>
                    </div>

                    {(encryptScope === 'table' || encryptScope === 'field') && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label>Table</Label>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                                    value={encryptTable}
                                    onChange={e => { setEncryptTable(e.target.value); setEncryptFields([]); }}
                                    disabled={!encryptConnUuid}
                                >
                                    <option value="">Select table</option>
                                    {encryptTables.map(t => (
                                        <option key={t.name} value={t.name}>
                                            {t.name}{t.row_count != null ? ` (${t.row_count.toLocaleString()} rows)` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {encryptScope === 'field' && (
                                <div>
                                    <Label>Fields</Label>
                                    <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                                        {selectedTableColumns.length === 0 && (
                                            <p className="text-xs text-muted-foreground px-1">Select a table to see columns.</p>
                                        )}
                                        {selectedTableColumns.map(col => (
                                            <label key={col.name} className="flex items-center gap-2 text-sm px-1 py-0.5 cursor-pointer hover:bg-muted/50 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={encryptFields.includes(col.name)}
                                                    onChange={() => toggleEncryptField(col.name)}
                                                />
                                                <span className="font-mono text-xs">{col.name}</span>
                                                <span className="text-muted-foreground text-xs">({col.type})</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {encryptMessage && (
                        <div className={`rounded-lg border p-3 text-sm ${encryptMessage.type === 'success' ? 'border-green-500/40 bg-green-500/10' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
                            {encryptMessage.text}
                        </div>
                    )}

                    {!encryptSupports && encryptConnUuid && (
                        <p className="text-sm text-destructive">This connection type does not support in-database encryption. Use a SQL connection (MySQL, PostgreSQL, SQL Server).</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {encryptScope === 'database' && (
                            <Button onClick={runEncryption} disabled={encrypting || !encryptConnUuid || !encryptSupports}>
                                {encrypting ? <Spinner className="mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                                {encrypting ? 'Queuing…' : 'Encrypt Whole Database'}
                            </Button>
                        )}
                        {encryptScope === 'table' && (
                            <Button onClick={runEncryption} disabled={encrypting || !encryptConnUuid || !encryptTable || !encryptSupports}>
                                {encrypting ? <Spinner className="mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                                {encrypting ? 'Queuing…' : 'Encrypt Table'}
                            </Button>
                        )}
                        {encryptScope === 'field' && (
                            <Button onClick={runEncryption} disabled={encrypting || !encryptConnUuid || !encryptTable || encryptFields.length === 0 || !encryptSupports}>
                                {encrypting ? <Spinner className="mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                                {encrypting ? 'Queuing…' : `Encrypt Field${encryptFields.length > 1 ? 's' : ''}`}
                            </Button>
                        )}
                    </div>

                    {encryptJobs.length > 0 && (
                        <div className="border-t border-sidebar-border/50 pt-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Encryption Jobs</p>
                            {encryptJobs.map(job => (
                                <div key={job.uuid} className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-lg bg-muted/30 px-3 py-2">
                                    <div>
                                        <span className="capitalize font-medium">{job.payload?.scope ?? 'encrypt'}</span>
                                        {job.payload?.table && <span className="text-muted-foreground"> — {job.payload.table}</span>}
                                        {job.payload?.algorithm && <span className="text-muted-foreground text-xs ml-2">({job.payload.algorithm})</span>}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                        {job.status === 'running' || job.status === 'pending' ? (
                                            <span className="flex items-center gap-1 text-yellow-600"><Spinner className="h-3 w-3" /> {job.status}</span>
                                        ) : job.status === 'completed' ? (
                                            <span className="text-green-600">completed — {job.result?.processed ?? 0} values</span>
                                        ) : (
                                            <span className="text-destructive" title={job.error_message ?? ''}>failed</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-sidebar-border/70 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50"><tr>
                            {['Name', 'Type', 'Host', 'Health', 'Objects', 'Size', 'Actions'].map(h => (
                                <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody className="divide-y divide-sidebar-border/40">
                            {connections.data.map(c => (
                                <tr key={c.id} className="hover:bg-muted/20">
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{c.name}</div>
                                        <div className="text-xs text-muted-foreground">{c.project?.name}</div>
                                    </td>
                                    <td className="px-4 py-3 capitalize">{c.database_type}</td>
                                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.host}:{c.port}</td>
                                    <td className={`px-4 py-3 capitalize font-medium ${statusColor(c.health_status)}`}>{c.health_status}</td>
                                    <td className="px-4 py-3">{c.table_count} / {c.record_count_estimate?.toLocaleString() ?? 0}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{fmtBytes(c.database_size_bytes)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => openEdit(c)} className="p-1 hover:text-primary" title="Edit">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <Link href={`/admin/secure-db/connections/${c.uuid}/explorer`} className="p-1 hover:text-primary" title="Explorer">
                                                <ExternalLink className="h-4 w-4" />
                                            </Link>
                                            <button onClick={() => runTest(c.uuid)} disabled={testing === c.uuid} className="p-1 hover:text-primary" title="Test">
                                                <RefreshCw className={`h-4 w-4 ${testing === c.uuid ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button onClick={() => router.delete(`/admin/secure-db/connections/${c.uuid}`)} className="p-1 hover:text-destructive" title="Delete">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
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
