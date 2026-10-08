import { Head, router, usePage } from '@inertiajs/react';
import {
    Building2, Copy, Check, Eye, EyeOff, RefreshCw, Users, AlertCircle, KeyRound, Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Company Credentials', href: '/company/credentials' },
];

interface OrganizationData {
    id: number;
    name: string;
    client_id: string | null;
    client_secret?: string | null;
    client_credentials_active: boolean;
    client_credentials_created_at: string | null;
}

interface ServiceRow {
    id: number;
    key: string;
    name: string;
    description?: string | null;
}

interface ServiceKeyRow {
    uuid: string;
    name: string;
    key_prefix: string;
    service_key: string;
    service_name: string;
    is_active: boolean;
    last_used_at: string | null;
    created_at: string | null;
}

type PageProps = {
    organization: OrganizationData;
    services?: ServiceRow[];
    serviceKeys?: ServiceKeyRow[];
    plain_service_key?: string | null;
} & Record<string, unknown>;

export default function CompanyCredentials() {
    const { organization, services = [], serviceKeys = [], plain_service_key = null } = usePage<PageProps>().props;
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [serviceKeyName, setServiceKeyName] = useState('');
    const [selectedService, setSelectedService] = useState(services[0]?.key ?? 'chat');
    const [isGeneratingServiceKey, setIsGeneratingServiceKey] = useState(false);

    const orgQuery = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('organization_id')
        ? `?organization_id=${new URLSearchParams(window.location.search).get('organization_id')}`
        : '';

    const plainSecret = organization.client_secret ?? null;

    const handleCopy = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleGenerate = () => {
        setIsGenerating(true);
        router.post(`/company/credentials/generate${orgQuery}`, {}, {
            onFinish: () => setIsGenerating(false),
        });
    };

    const handleRevoke = () => {
        if (confirm('Deactivate organization credentials? All API access will stop until new credentials are generated.')) {
            router.delete(`/company/credentials${orgQuery}`);
        }
    };

    const handleGenerateServiceKey = () => {
        if (!serviceKeyName.trim() || !selectedService) return;
        setIsGeneratingServiceKey(true);
        router.post(`/company/credentials/service-keys${orgQuery}`, {
            service_key: selectedService,
            name: serviceKeyName.trim(),
        }, {
            onFinish: () => {
                setIsGeneratingServiceKey(false);
                setServiceKeyName('');
            },
        });
    };

    const handleRevokeServiceKey = (uuid: string) => {
        if (!confirm('Revoke this service key? Apps using it will stop working.')) return;
        router.delete(`/company/credentials/service-keys/${uuid}${orgQuery}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Company Credentials" />

            <div className="flex flex-col gap-8 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{organization.name}</h1>
                        <p className="text-muted-foreground">Organization API credentials and per-service keys</p>
                    </div>
                    <Button variant="outline" asChild>
                        <a href={`/company/users${orgQuery}`} className="gap-2">
                            <Users className="h-4 w-4" />Manage Users
                        </a>
                    </Button>
                </div>

                <div className="mx-auto w-full max-w-2xl rounded-xl border bg-card">
                    <div className="border-b p-6">
                        <div className="flex items-center gap-3">
                            <Building2 className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Organization Credentials</h2>
                        </div>
                    </div>

                    <div className="space-y-4 p-6">
                        {organization.client_credentials_active && organization.client_id ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Client ID</Label>
                                    <div className="flex gap-2">
                                        <Input readOnly value={organization.client_id} className="font-mono text-sm" />
                                        <Button variant="outline" size="icon" onClick={() => handleCopy(organization.client_id!, 'client_id')}>
                                            {copiedField === 'client_id' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>

                                {plainSecret && (
                                    <div className="space-y-2">
                                        <Label>Client Secret (copy now)</Label>
                                        <div className="flex gap-2">
                                            <Input readOnly type={showSecret ? 'text' : 'password'} value={plainSecret} className="font-mono text-sm" />
                                            <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={() => handleCopy(plainSecret, 'client_secret')}>
                                                {copiedField === 'client_secret' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-lg bg-yellow-50 p-3 text-sm dark:bg-yellow-950/50">
                                    <AlertCircle className="mb-1 inline h-4 w-4 text-yellow-600" />
                                    {' '}Send X-Client-Id, X-Client-Secret, Authorization Bearer, and X-Service-Key on service API calls.
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No active credentials. Generate credentials to enable API access for your organization.
                            </p>
                        )}

                        <div className="flex gap-2 pt-2">
                            <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
                                <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                                {organization.client_credentials_active ? 'Regenerate Credentials' : 'Generate Credentials'}
                            </Button>
                            {organization.client_credentials_active && (
                                <Button variant="destructive" onClick={handleRevoke}>Deactivate</Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mx-auto w-full max-w-2xl rounded-xl border bg-card">
                    <div className="border-b p-6">
                        <div className="flex items-center gap-3">
                            <KeyRound className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Per-service API keys</h2>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Generate one key per gateway service (chat, vault, drive, meet, walkie, …). Required header: X-Service-Key.
                        </p>
                    </div>

                    <div className="space-y-4 p-6">
                        {plain_service_key && (
                            <div className="space-y-2">
                                <Label>New service key (copy now)</Label>
                                <div className="flex gap-2">
                                    <Input readOnly value={plain_service_key} className="font-mono text-sm" />
                                    <Button variant="outline" size="icon" onClick={() => handleCopy(plain_service_key, 'service_key')}>
                                        {copiedField === 'service_key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Service</Label>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                    value={selectedService}
                                    onChange={(e) => setSelectedService(e.target.value)}
                                >
                                    {services.map((s) => (
                                        <option key={s.key} value={s.key}>{s.name} ({s.key})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label>Key name</Label>
                                <Input
                                    value={serviceKeyName}
                                    onChange={(e) => setServiceKeyName(e.target.value)}
                                    placeholder="e.g. Mobile app"
                                />
                            </div>
                        </div>

                        <Button onClick={handleGenerateServiceKey} disabled={isGeneratingServiceKey || !serviceKeyName.trim()}>
                            {isGeneratingServiceKey ? 'Generating…' : 'Generate service key'}
                        </Button>

                        <div className="space-y-2 pt-2">
                            {serviceKeys.length === 0 && (
                                <p className="text-sm text-muted-foreground">No service keys yet.</p>
                            )}
                            {serviceKeys.map((key) => (
                                <div key={key.uuid} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                                    <div>
                                        <div className="font-medium">{key.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {key.service_name} · {key.key_prefix}…
                                            {key.last_used_at ? ` · last used ${key.last_used_at}` : ' · never used'}
                                        </div>
                                    </div>
                                    <Button variant="destructive" size="icon" onClick={() => handleRevokeServiceKey(key.uuid)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
