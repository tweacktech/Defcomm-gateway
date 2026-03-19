// resources/js/pages/drive/share-expired.tsx
// Inertia view: 'drive/share-expired'
// Rendered by DriveController::shareAccessPage() when the share is not usable.

import { Head, usePage } from '@inertiajs/react';
import { TimerOff, XCircle, ShieldX, AlertTriangle, Shield, ArrowLeft } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Reason = 'expired' | 'exhausted' | 'revoked';

type PageProps = {
    reason: Reason;
} & Record<string, unknown>;

// ─── Config ───────────────────────────────────────────────────────────────────

const REASON_CONFIG: Record<Reason, {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    message: string;
    hint: string;
}> = {
    expired: {
        icon: <TimerOff className="h-9 w-9 text-yellow-600 dark:text-yellow-400" />,
        iconBg: 'bg-yellow-500/10',
        title: 'Link Has Expired',
        message: 'This share link passed its expiry date and is no longer accessible.',
        hint: 'Ask the file owner to generate a new share link with an updated expiry.',
    },
    exhausted: {
        icon: <XCircle className="h-9 w-9 text-orange-600 dark:text-orange-400" />,
        iconBg: 'bg-orange-500/10',
        title: 'Usage Limit Reached',
        message: 'This share link has been used the maximum number of times allowed by the owner.',
        hint: 'Ask the file owner to create a new link or increase the usage limit.',
    },
    revoked: {
        icon: <ShieldX className="h-9 w-9 text-red-600 dark:text-red-400" />,
        iconBg: 'bg-red-500/10',
        title: 'Link Has Been Revoked',
        message: 'The owner of this file has revoked access to this share link.',
        hint: 'Contact the person who shared this link to request a new one.',
    },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShareExpired() {
    const { reason } = usePage<PageProps>().props;

    const config = REASON_CONFIG[reason] ?? REASON_CONFIG.revoked;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Head title="Share Link Unavailable" />

            {/* Brand */}
            <div className="mb-6 flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                    <Shield className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-muted-foreground">Secure Drive Share</span>
            </div>

            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-sidebar-border/70 bg-card p-10 text-center shadow-xl">

                    {/* Icon */}
                    <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${config.iconBg}`}>
                        {config.icon}
                    </div>

                    {/* Title + message */}
                    <h1 className="mb-2 text-2xl font-bold">{config.title}</h1>
                    <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{config.message}</p>

                    {/* Hint box */}
                    <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3.5 text-left">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                        <p className="text-xs leading-relaxed text-yellow-700 dark:text-yellow-400">
                            {config.hint}
                        </p>
                    </div>

                    {/* Back link */}
                    <a href="/"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" />Go to homepage
                    </a>
                </div>
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground/50">
                Powered by Drive · End-to-end encrypted tokens
            </p>
        </div>
    );
}
