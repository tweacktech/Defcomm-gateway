import { Head, Link } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { secureDbBreadcrumbs } from './_shared';

function ShieldIcon() {
    return (
        <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M60 8L15 28v30c0 28 19 54 45 62 26-8 45-34 45-62V28L60 8z" fill="currentColor" className="text-primary/20" stroke="currentColor" strokeWidth="2" />
            <path d="M60 35v25M48 55h24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-primary animate-pulse" />
        </svg>
    );
}

function LockIcon() {
    return (
        <svg viewBox="0 0 64 64" className="h-16 w-16 text-primary" fill="none">
            <rect x="16" y="28" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="3" className="animate-[bounce_2s_ease-in-out_infinite]" />
            <path d="M24 28V20a8 8 0 0116 0v8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="42" r="3" fill="currentColor" />
        </svg>
    );
}

function FlowIcon() {
    return (
        <svg viewBox="0 0 200 60" className="w-full h-12 text-primary/60">
            <defs>
                <linearGradient id="flow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
                    <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d="M10 30 Q50 10 90 30 T170 30" stroke="url(#flow)" strokeWidth="2" fill="none" className="animate-pulse" />
            <circle cx="10" cy="30" r="4" fill="currentColor" />
            <circle cx="90" cy="30" r="4" fill="currentColor" className="animate-ping" />
            <circle cx="170" cy="30" r="4" fill="currentColor" />
        </svg>
    );
}

export default function SecureDbBranding() {
    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Branding')}>
            <Head title="Secure DB — Branding" />
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center gap-8">
                <div className="relative">
                    <ShieldIcon />
                    <div className="absolute -bottom-2 -right-2"><LockIcon /></div>
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Secure DB</h1>
                    <p className="text-lg text-muted-foreground mt-2">Enterprise Encryption Middleware</p>
                    <p className="text-sm text-muted-foreground mt-1">DefComm Gateway · Dynamic Encryption · Key Rotation · Multi-Tenant Isolation</p>
                </div>
                <div className="w-full max-w-md"><FlowIcon /></div>
                <div className="flex gap-6 text-sm text-muted-foreground">
                    <span>AES-256-GCM</span><span>·</span><span>ChaCha20-Poly1305</span><span>·</span><span>RSA-4096 Hybrid</span>
                </div>
                <Link href="/admin/secure-db" className="text-primary hover:underline text-sm">← Back to Dashboard</Link>
            </div>
        </AppLayout>
    );
}
