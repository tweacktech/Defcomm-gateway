import { Head, usePage, router } from '@inertiajs/react';
import {
    Copy,
    Check,
    Eye,
    EyeOff,
    RefreshCw,
    Key,
    Shield,
    Clock,
    AlertCircle,
    Building2,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { edit } from '@/routes/profile';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'API Credentials', href: edit().url },
];

interface OrganizationCredentials {
    id: number;
    name: string;
    client_id: string | null;
    client_secret?: string | null;
    client_credentials_active: boolean;
}

type PageProps = {
    organization: OrganizationCredentials | null;
    access_token?: string | null;
    can_manage_org_credentials: boolean;
    role_label: string;
    auth: { user: { id: number; role: string } };
} & Record<string, unknown>;

export default function Token() {
    const {
        organization,
        access_token,
        can_manage_org_credentials,
        role_label,
    } = usePage<PageProps>().props;

    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [showAccessToken, setShowAccessToken] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const orgClientSecret = organization?.client_secret ?? null;
    const userAccessToken = access_token ?? null;
    const hasOrgCredentials =
        organization?.client_credentials_active && organization?.client_id;

    const handleCopy = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleGenerateToken = () => {
        setIsGenerating(true);
        router.post(
            '/generate-access-token',
            {},
            {
                onFinish: () => setIsGenerating(false),
            },
        );
    };

    const handleRevokeToken = () => {
        router.delete('/revoke-access-token');
    };

    const maskString = (str: string, visibleChars = 8) => {
        if (!str) return '';
        const firstChars = str.slice(0, visibleChars);
        const lastChars = str.slice(-4);
        const maskedLength = str.length - (visibleChars + 4);
        return `${firstChars}${'•'.repeat(Math.min(maskedLength, 20))}${lastChars}`;
    };

    const CopyButton = ({
        value,
        field,
        disabled,
    }: {
        value: string;
        field: string;
        disabled?: boolean;
    }) => (
        <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            disabled={disabled}
            onClick={() => handleCopy(value, field)}
        >
            {copiedField === field ? (
                <>
                    <Check className="mr-1 h-3.5 w-3.5 text-green-600" />
                    Copied!
                </>
            ) : (
                <>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                </>
            )}
        </Button>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="API Credentials" />

            <div className="flex flex-col gap-8 p-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        API Credentials
                    </h1>
                    <p className="text-muted-foreground">
                        Your role: <span className="font-medium">{role_label}</span>.
                        Use organization credentials + your personal bearer token to access services.
                    </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        {/* Organization credentials (from company) */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card">
                            <div className="border-b p-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2.5">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold">
                                            Organization Credentials
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            {organization?.name ?? 'No organization'} — provided by your company
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 p-6">
                                {!hasOrgCredentials ? (
                                    <div className="py-8 text-center text-sm text-muted-foreground">
                                        {can_manage_org_credentials ? (
                                            <>
                                                No credentials yet.{' '}
                                                <a
                                                    href="/company/credentials"
                                                    className="text-primary underline"
                                                >
                                                    Generate organization credentials
                                                </a>
                                            </>
                                        ) : (
                                            'Ask your company admin to generate organization API credentials.'
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="client_id">Client ID</Label>
                                            <div className="relative">
                                                <Input
                                                    id="client_id"
                                                    readOnly
                                                    value={organization!.client_id ?? ''}
                                                    className="bg-muted/50 pr-24 font-mono text-sm"
                                                />
                                                <div className="absolute top-1/2 right-1 -translate-y-1/2">
                                                    <CopyButton
                                                        value={organization!.client_id ?? ''}
                                                        field="client_id"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        {/* <div className="space-y-2">
                                            <Label htmlFor="client_secret">Secret Key</Label>
                                            <div className="relative">
                                                <Input
                                                    id="client_secret"
                                                    readOnly
                                                    value={organization!.client_secret ?? ''}
                                                    className="bg-muted/50 pr-24 font-mono text-sm"
                                                />
                                                <div className="absolute top-1/2 right-1 -translate-y-1/2">
                                                    <CopyButton
                                                        value={organization!.client_secret ?? ''}
                                                        field="client_id"
                                                    />
                                                </div>
                                            </div>
                                        </div> */}

                                        {orgClientSecret && (
                                            <div className="space-y-2">
                                                <Label htmlFor="client_secret">
                                                    Client Secret
                                                    <span className="ml-2 text-xs text-yellow-600">
                                                        (shown once after generation)
                                                    </span>
                                                </Label>
                                                <div className="relative">
                                                    <Input
                                                        id="client_secret"
                                                        readOnly
                                                        type={showSecret ? 'text' : 'password'}
                                                        value={
                                                            showSecret
                                                                ? orgClientSecret
                                                                : maskString(orgClientSecret)
                                                        }
                                                        className="bg-muted/50 pr-36 font-mono text-sm"
                                                    />
                                                    <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2"
                                                            onClick={() => setShowSecret(!showSecret)}
                                                        >
                                                            {showSecret ? (
                                                                <EyeOff className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <Eye className="h-3.5 w-3.5" />
                                                            )}
                                                        </Button>
                                                        <CopyButton
                                                            value={orgClientSecret}
                                                            field="client_secret"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* User bearer token */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card">
                            <div className="border-b p-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2.5">
                                        <Key className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold">
                                            Your Access Token
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            Personal bearer token — use with organization credentials
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 p-6">
                                <div className="space-y-2">
                                    <Label htmlFor="access_token">
                                        Bearer Token
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="access_token"
                                            readOnly
                                            type={showAccessToken ? 'text' : 'password'}
                                            value={
                                                userAccessToken
                                                    ? showAccessToken
                                                        ? userAccessToken
                                                        : maskString(userAccessToken)
                                                    : ''
                                            }
                                            placeholder="Generate a token to use the API"
                                            className="bg-muted/50 pr-36 font-mono text-sm"
                                        />
                                        {userAccessToken && (
                                            <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 px-2"
                                                    onClick={() =>
                                                        setShowAccessToken(!showAccessToken)
                                                    }
                                                >
                                                    {showAccessToken ? (
                                                        <EyeOff className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Eye className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                                <CopyButton
                                                    value={userAccessToken}
                                                    field="access_token"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 border-t pt-4">
                                    <Button
                                        onClick={handleGenerateToken}
                                        disabled={isGenerating || !hasOrgCredentials}
                                        className="gap-2"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw className="h-4 w-4" />
                                                {userAccessToken
                                                    ? 'Regenerate Token'
                                                    : 'Generate Token'}
                                            </>
                                        )}
                                    </Button>
                                    {userAccessToken && (
                                        <Button
                                            variant="outline"
                                            className="gap-2"
                                            onClick={handleRevokeToken}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Revoke
                                        </Button>
                                    )}
                                </div>

                                {userAccessToken && (
                                    <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/50">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
                                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                                Regenerating invalidates your previous token immediately.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-4 font-semibold">Authentication Flow</h3>
                            <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
                                <li>Company admin generates Client ID + Secret</li>
                                <li>Company shares credentials with users</li>
                                <li>User generates a personal bearer token</li>
                                <li>Include all three on every API request</li>
                            </ol>
                        </div>

                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-4 font-semibold">Example Request</h3>
                            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                                {`curl -X POST /api/chat/push \\
  -H "X-Client-Id: YOUR_CLIENT_ID" \\
  -H "X-Client-Secret: YOUR_CLIENT_SECRET" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"recipient_id":2,"message":"Hello"}'`}
                            </pre>
                        </div>

                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-4 font-semibold">Security Tips</h3>
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-start gap-2">
                                    <Shield className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span className="text-muted-foreground">
                                        Never share your bearer token publicly
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Clock className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span className="text-muted-foreground">
                                        Revoke tokens you no longer use
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
