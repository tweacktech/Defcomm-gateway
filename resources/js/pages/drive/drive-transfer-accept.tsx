// resources/js/pages/drive/transfer-accept.tsx
// Inertia view: 'drive/transfer-accept'
// Route: GET /drive/transfer/{token}  (auth required — recipient only)
//
// Shows the recipient the item being offered, sender info, and Accept/Decline CTAs.

import { Head, usePage, router } from '@inertiajs/react';
import {
    Send, File, Folder, Globe, Lock, User,
    CheckCircle2, XCircle, Shield, AlertTriangle,
    RefreshCw, ChevronLeft,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Visibility = 'private' | 'public';

interface ShareToken {
    id: number;
    token: string;
}

interface TransferItem {
    id: number;
    name: string;
    type: 'folder' | 'file';
    size_human: string;
    visibility: Visibility;
}

interface Sender {
    name: string;
    email: string;
}

type PageProps = {
    share: ShareToken;
    item: TransferItem;
    from: Sender;
    auth: { user: { id: number; name: string; email: string } };
} & Record<string, unknown>;

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Drive',    href: '/drive' },
    { title: 'Transfer', href: '#' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransferAccept() {
    const { share, item, from, auth } = usePage<PageProps>().props;

    const [accepting, setAccepting]   = useState(false);
    const [declining, setDeclining]   = useState(false);
    const [decision, setDecision]     = useState<'accepted' | 'declined' | null>(null);
    const [confirmDecline, setConfirm]= useState(false);

    const handleAccept = () => {
        setAccepting(true);
        router.post(`/drive/transfer/${share.token}/accept`, {}, {
            onSuccess: () => setDecision('accepted'),
            onError:   () => setAccepting(false),
        });
    };

    const handleDecline = () => {
        setDeclining(true);
        router.post(`/drive/transfer/${share.token}/decline`, {}, {
            onSuccess: () => setDecision('declined'),
            onError:   () => setDeclining(false),
        });
    };

    // ── Post-decision screen ─────────────────────────────────────────────────
    if (decision === 'accepted') {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Transfer Accepted" />
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                    <div className="w-full max-w-sm rounded-2xl border border-sidebar-border/70 bg-card p-10 shadow-xl">
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                            <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                        <h1 className="mb-2 text-xl font-bold">Transfer Accepted!</h1>
                        <p className="mb-6 text-sm text-muted-foreground">
                            <strong>{item.name}</strong> is now in your Drive.
                        </p>
                        <Button onClick={() => router.get('/drive')} className="w-full gap-2">
                            <File className="h-4 w-4" />Go to My Drive
                        </Button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (decision === 'declined') {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Transfer Declined" />
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                    <div className="w-full max-w-sm rounded-2xl border border-sidebar-border/70 bg-card p-10 shadow-xl">
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                            <XCircle className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h1 className="mb-2 text-xl font-bold">Transfer Declined</h1>
                        <p className="mb-6 text-sm text-muted-foreground">
                            The transfer of <strong>{item.name}</strong> has been declined.
                            The file remains with {from.name}.
                        </p>
                        <Button variant="outline" onClick={() => router.get('/drive')} className="w-full gap-2">
                            <ChevronLeft className="h-4 w-4" />Back to My Drive
                        </Button>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // ── Main transfer page ────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Transfer Offer — ${item.name}`} />

            <div className="flex flex-1 flex-col items-center justify-center p-6">
                <div className="w-full max-w-md space-y-4">

                    {/* Header card */}
                    <div className="rounded-2xl border border-sidebar-border/70 bg-card p-8 text-center shadow-xl">

                        {/* Transfer icon */}
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                            <Send className="h-7 w-7 text-primary" />
                        </div>

                        <h1 className="mb-1 text-xl font-bold">You've Received a Transfer Offer</h1>
                        <p className="text-sm text-muted-foreground">
                            <strong>{from.name}</strong> wants to transfer ownership of an item to you.
                        </p>
                    </div>

                    {/* Item card */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card overflow-hidden">
                        <div className="flex items-center gap-4 bg-muted/20 p-6">
                            <div className="rounded-xl bg-card p-3 shadow-sm">
                                {item.type === 'folder'
                                    ? <Folder className="h-8 w-8 text-yellow-400" />
                                    : <File className="h-8 w-8 text-primary" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-lg font-bold">{item.name}</p>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="text-sm capitalize text-muted-foreground">{item.type}</span>
                                    {item.type === 'file' && (
                                        <>
                                            <span className="text-muted-foreground">·</span>
                                            <span className="text-sm text-muted-foreground">{item.size_human}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="divide-y divide-sidebar-border/40 px-6 py-2 text-sm">
                            {/* Sender */}
                            <div className="flex items-center justify-between py-3">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-3.5 w-3.5" />From
                                </span>
                                <div className="text-right">
                                    <p className="font-medium">{from.name}</p>
                                    <p className="text-xs text-muted-foreground">{from.email}</p>
                                </div>
                            </div>

                            {/* Recipient */}
                            <div className="flex items-center justify-between py-3">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Shield className="h-3.5 w-3.5" />To (you)
                                </span>
                                <div className="text-right">
                                    <p className="font-medium">{auth.user.name}</p>
                                    <p className="text-xs text-muted-foreground">{auth.user.email}</p>
                                </div>
                            </div>

                            {/* Visibility */}
                            <div className="flex items-center justify-between py-3">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    {item.visibility === 'public'
                                        ? <Globe className="h-3.5 w-3.5" />
                                        : <Lock className="h-3.5 w-3.5" />}
                                    Visibility
                                </span>
                                <span className={`font-medium capitalize ${item.visibility === 'public' ? 'text-green-600 dark:text-green-400' : ''}`}>
                                    {item.visibility}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                        <p className="text-xs leading-relaxed text-yellow-700 dark:text-yellow-400">
                            Accepting this transfer will permanently move <strong>{item.name}</strong> into
                            your Drive. The sender will lose ownership and cannot undo this action.
                        </p>
                    </div>

                    {/* Actions */}
                    {!confirmDecline ? (
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={handleAccept}
                                disabled={accepting || declining}
                                className="h-12 gap-2 text-sm font-semibold">
                                {accepting
                                    ? <><RefreshCw className="h-4 w-4 animate-spin" />Accepting…</>
                                    : <><CheckCircle2 className="h-4 w-4" />Accept Transfer</>}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setConfirm(true)}
                                disabled={accepting || declining}
                                className="h-12 gap-2 text-sm text-muted-foreground">
                                <XCircle className="h-4 w-4" />Decline
                            </Button>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                            <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                Are you sure you want to decline this transfer?
                            </p>
                            <p className="text-xs text-red-600/80 dark:text-red-400/80">
                                The file will remain with {from.name}.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="destructive"
                                    onClick={handleDecline}
                                    disabled={declining}
                                    className="gap-2">
                                    {declining
                                        ? <><RefreshCw className="h-4 w-4 animate-spin" />Declining…</>
                                        : <><XCircle className="h-4 w-4" />Yes, Decline</>}
                                </Button>
                                <Button variant="outline" onClick={() => setConfirm(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
