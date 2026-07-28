import { Head, useForm } from '@inertiajs/react';
import { Shield, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Props = {
    clientId: number | string;
    clientName?: string;
    scope: string;
    redirectUri: string;
    state: string;
};

// Human-readable descriptions for known scopes. Unknown scopes still render,
// just without a friendly description.
const SCOPE_DESCRIPTIONS: Record<string, string> = {
    read: 'View your profile and basic account information',
    write: 'Create and modify data on your behalf',
    admin: 'Full administrative access to your account',
};

export default function OAuthAuthorize({ clientId, clientName, scope, redirectUri, state }: Props) {
    const scopes = scope.split(/[\s,]+/).filter(Boolean);

    const { post, processing, setData } = useForm({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        approve: false,
    });

    const respond = (approve: boolean) => {
        setData('approve', approve);
        // Inertia's setData is async-batched, so post explicit payload instead
        // of relying on state having flushed before submit.
        post('/auth/authorize', {
            data: {
                client_id: clientId,
                redirect_uri: redirectUri,
                scope,
                state,
                approve,
            },
        } as never);
    };

    let host = redirectUri;
    try {
        host = new URL(redirectUri).host;
    } catch {
        // keep raw value if redirectUri isn't a valid absolute URL
    }

    return (
        <>
            <Head title="Authorize Application" />

            <div className="min-h-screen bg-background flex items-center justify-center px-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center space-y-3">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                            <Shield className="h-6 w-6" />
                        </div>
                        <CardTitle className="text-xl">
                            {clientName ?? 'An application'} wants to access your Defcomm account
                        </CardTitle>
                        <CardDescription>
                            It will redirect back to <span className="font-medium text-foreground">{host}</span> after you decide.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">This will allow the app to:</p>
                            <ul className="space-y-2">
                                {scopes.map((s) => (
                                    <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                                        <span>
                                            <Badge variant="outline" className="mr-2 align-middle">
                                                {s}
                                            </Badge>
                                            {SCOPE_DESCRIPTIONS[s] ?? 'Access related to this scope'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 gap-2"
                                disabled={processing}
                                onClick={() => respond(false)}
                            >
                                <X className="h-4 w-4" />
                                Deny
                            </Button>
                            <Button className="flex-1 gap-2" disabled={processing} onClick={() => respond(true)}>
                                <Check className="h-4 w-4" />
                                Approve
                            </Button>
                        </div>

                        <p className="text-xs text-center text-muted-foreground">
                            You can revoke access at any time from your account settings.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
