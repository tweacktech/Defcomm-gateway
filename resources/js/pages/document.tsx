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
    Download,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { edit } from '@/routes/profile';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Documentation',
        href: edit().url,
    },
];

interface ApiClient {
    id: number;
    user_id: number;
    client_id: string;
    client_secret: string;
    access_token?: string | null;
    name?: string;
    created_at: string;
    updated_at: string;
    expires_at?: string;
}

type PageProps = {
    client: ApiClient | null;
    access_token?: string | null;
    auth: {
        user: unknown;
    };
} & Record<string, unknown>;

export default function Document() {
    // Get the client data from Inertia props
    const { client, access_token } = usePage<PageProps>().props;

    const [credentials, setCredentials] = useState<ApiClient | null>(client);
  

   
 

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
                                    
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                                                Active
                                            </span>
                                        </div>
                                   
                                </div>
                            </div>

                            <div className="space-y-6 p-6">
                                <div className="py-12 text-center">
                                    <Key className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                                    <h3 className="mb-2 text-lg font-medium">
                                        No credentials found
                                    </h3>
                                    <p className="mb-6 text-sm text-muted-foreground">
                                        You haven't generated any API
                                        credentials yet. Generate your first set
                                        to get started.
                                    </p>
                                </div>

                                {/* Warning for regeneration */}
                                
                                    <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/50">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
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
