import { useState, FormEvent } from 'react';
import { router } from '@inertiajs/react';
import { Mail, KeyRound, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Drop this into your existing login page (e.g. below the password form,
 * or as a tab alongside it) to offer magic-link and API-token sign-in.
 *
 *   <AlternateLoginOptions />
 */
export default function AlternateLoginOptions() {
    const [email, setEmail] = useState('');
    const [token, setToken] = useState('');
    const [sendingLink, setSendingLink] = useState(false);
    const [linkSent, setLinkSent] = useState(false);
    const [submittingToken, setSubmittingToken] = useState(false);
    const [tokenError, setTokenError] = useState<string | null>(null);

    const submitMagicLink = (e: FormEvent) => {
        e.preventDefault();
        setSendingLink(true);
        router.post(
            '/auth/magic-link',
            { email },
            {
                preserveScroll: true,
                onFinish: () => {
                    setSendingLink(false);
                    setLinkSent(true);
                },
            }
        );
    };

    const submitToken = (e: FormEvent) => {
        e.preventDefault();
        setSubmittingToken(true);
        setTokenError(null);
        router.post(
            '/auth/token-login',
            { token },
            {
                preserveScroll: true,
                onError: () => {
                    setTokenError('That token is invalid, expired, or not enabled for sign-in.');
                    setSubmittingToken(false);
                },
                onFinish: () => setSubmittingToken(false),
            }
        );
    };

    return (
        <Tabs defaultValue="magic-link" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="magic-link" className="gap-2">
                    <Mail className="h-4 w-4" />
                    Magic link
                </TabsTrigger>
                <TabsTrigger value="token" className="gap-2">
                    <KeyRound className="h-4 w-4" />
                    API token
                </TabsTrigger>
            </TabsList>

            <TabsContent value="magic-link" className="pt-4">
                {linkSent ? (
                    <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800/50 p-3 text-sm text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>If that email has an account, a sign-in link is on its way. It expires in 15 minutes.</span>
                    </div>
                ) : (
                    <form onSubmit={submitMagicLink} className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="magic-link-email">Email</Label>
                            <Input
                                id="magic-link-email"
                                type="email"
                                required
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <Button type="submit" className="w-full gap-2" disabled={sendingLink}>
                            {sendingLink && <Loader2 className="h-4 w-4 animate-spin" />}
                            Send sign-in link
                        </Button>
                    </form>
                )}
            </TabsContent>

            <TabsContent value="token" className="pt-4">
                <form onSubmit={submitToken} className="space-y-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="api-token">API token</Label>
                        <Input
                            id="api-token"
                            type="password"
                            required
                            placeholder="dct_..."
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Only tokens created with sign-in enabled will work here.
                        </p>
                    </div>
                    {tokenError && <p className="text-sm text-destructive">{tokenError}</p>}
                    <Button type="submit" className="w-full gap-2" disabled={submittingToken}>
                        {submittingToken && <Loader2 className="h-4 w-4 animate-spin" />}
                        Sign in with token
                    </Button>
                </form>
            </TabsContent>
        </Tabs>
    );
}
