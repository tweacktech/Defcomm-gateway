import { Head, Link, usePage, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { edit } from '@/routes/profile';
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
    Download,
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Profile settings',
        href: edit().url,
    },
];

interface ApiClient {
    id: number;
    user_id: number;
    client_id: string;
    client_secret: string;
    name?: string;
    created_at: string;
    updated_at: string;
    expires_at?: string;
}

interface PageProps {
    client: ApiClient | null;
    auth: {
        user: any;
    };
}

export default function Token() {
    // Get the client data from Inertia props
    const { client } = usePage<PageProps>().props;

    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [credentials, setCredentials] = useState<ApiClient | null>(client);

    const handleCopy = async (text: string, field: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleGenerate = () => {
        setIsGenerating(true);

        // Make a POST request to generate new credentials
        router.post(
            '/generate-access-token',
            {},
            {
                onSuccess: (page) => {
                    // Update credentials with the new data from the response
                    const newClient = page.props.client as ApiClient;
                    setCredentials(newClient);
                    setIsGenerating(false);
                },
                onError: (errors) => {
                    console.error('Failed to generate credentials:', errors);
                    setIsGenerating(false);
                },
            },
        );
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const maskString = (str: string, visibleChars = 8) => {
        if (!str) return '';
        const firstChars = str.slice(0, visibleChars);
        const lastChars = str.slice(-4);
        const maskedLength = str.length - (visibleChars + 4);
        return `${firstChars}${'•'.repeat(Math.min(maskedLength, 20))}${lastChars}`;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="API Credentials" />

            <div className="flex flex-col gap-8 p-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        API Credentials
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your client credentials for API authentication
                    </p>
                </div>

                {/* Main Content */}
                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Credentials Card */}
                    <div className="space-y-6 lg:col-span-2">
                        <div className="rounded-xl border border-sidebar-border/70 bg-card">
                            <div className="border-b p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-lg bg-primary/10 p-2.5">
                                            <Key className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold">
                                                Client Credentials
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                Use these credentials to
                                                authenticate your API requests
                                            </p>
                                        </div>
                                    </div>
                                    {credentials && (
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                                                Active
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-6 p-6">
                                {credentials ? (
                                    <>
                                        {/* Client ID */}
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="client_id"
                                                className="text-sm font-medium"
                                            >
                                                Client ID
                                            </Label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        id="client_id"
                                                        type="text"
                                                        value={
                                                            credentials.client_id
                                                        }
                                                        readOnly
                                                        className="bg-muted/50 pr-24 font-mono text-sm"
                                                    />
                                                    <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() =>
                                                                handleCopy(
                                                                    credentials.client_id,
                                                                    'client_id',
                                                                )
                                                            }
                                                        >
                                                            {copiedField ===
                                                            'client_id' ? (
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
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Client Secret */}
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="client_secret"
                                                className="text-sm font-medium"
                                            >
                                                Client Secret
                                                <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                                                    (Keep this secure!)
                                                </span>
                                            </Label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        id="client_secret"
                                                        type={
                                                            showSecret
                                                                ? 'text'
                                                                : 'password'
                                                        }
                                                        value={
                                                            showSecret
                                                                ? credentials.client_secret
                                                                : maskString(
                                                                      credentials.client_secret,
                                                                  )
                                                        }
                                                        readOnly
                                                        className="bg-muted/50 pr-36 font-mono text-sm"
                                                    />
                                                    <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() =>
                                                                setShowSecret(
                                                                    !showSecret,
                                                                )
                                                            }
                                                        >
                                                            {showSecret ? (
                                                                <EyeOff className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <Eye className="h-3.5 w-3.5" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() =>
                                                                handleCopy(
                                                                    credentials.client_secret,
                                                                    'client_secret',
                                                                )
                                                            }
                                                        >
                                                            {copiedField ===
                                                            'client_secret' ? (
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
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Metadata */}
                                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-muted-foreground">
                                                    Created:
                                                </span>
                                                <span className="font-medium">
                                                    {formatDate(
                                                        credentials.created_at,
                                                    )}
                                                </span>
                                            </div>
                                            {credentials.expires_at && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-muted-foreground">
                                                        Expires:
                                                    </span>
                                                    <span className="font-medium">
                                                        {formatDate(
                                                            credentials.expires_at,
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-12 text-center">
                                        <Key className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                                        <h3 className="mb-2 text-lg font-medium">
                                            No credentials found
                                        </h3>
                                        <p className="mb-6 text-sm text-muted-foreground">
                                            You haven't generated any API
                                            credentials yet. Generate your first
                                            set to get started.
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-3 border-t pt-4">
                                    <Button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
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
                                                {credentials
                                                    ? 'Regenerate Credentials'
                                                    : 'Generate Credentials'}
                                            </>
                                        )}
                                    </Button>

                                    {credentials && (
                                        <Button
                                            variant="outline"
                                            className="gap-2"
                                        >
                                            <Download className="h-4 w-4" />
                                            Download
                                        </Button>
                                    )}
                                </div>

                                {/* Warning for regeneration */}
                                {credentials && (
                                    <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/50">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
                                            <div className="text-sm text-yellow-800 dark:text-yellow-300">
                                                <p className="font-medium">
                                                    Important:
                                                </p>
                                                <p>
                                                    Regenerating credentials
                                                    will immediately invalidate
                                                    your existing credentials.
                                                    Any applications using the
                                                    old credentials will need to
                                                    be updated.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar - Keep the same as before */}
                    <div className="space-y-4">
                        {/* Info Card */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-4 font-semibold">
                                Using Your Credentials
                            </h3>
                            <div className="space-y-4 text-sm">
                                <p className="text-muted-foreground">
                                    Include your credentials in the
                                    Authorization header:
                                </p>
                                <div className="rounded-lg bg-muted p-3 font-mono text-xs">
                                    Authorization: Bearer {'{client_secret}'}
                                </div>
                                <div className="space-y-2">
                                    <p className="font-medium">
                                        Example Request:
                                    </p>
                                    <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                                        {`curl -X GET https://api.example.com/v1/users \\
  -H "Authorization: Bearer YOUR_CLIENT_SECRET" \\
  -H "X-Client-ID: YOUR_CLIENT_ID"`}
                                    </pre>
                                </div>
                            </div>
                        </div>

                        {/* Security Tips */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                            <h3 className="mb-4 font-semibold">
                                Security Tips
                            </h3>
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-start gap-2">
                                    <Shield className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span className="text-muted-foreground">
                                        Never share your client secret publicly
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Shield className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span className="text-muted-foreground">
                                        Rotate credentials regularly
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Shield className="mt-0.5 h-4 w-4 text-green-600" />
                                    <span className="text-muted-foreground">
                                        Use environment variables for storage
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
