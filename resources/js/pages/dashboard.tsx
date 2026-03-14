import { Head, Link, usePage } from '@inertiajs/react';
import {
    Package, ArrowUpRight, CheckCircle2,
    ShoppingCart, Clock, Settings, Sparkles,
} from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { ActivityFeed, type ActivityEntry } from '@/components/activity-feed';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
    id: number;
    name: string;
    description: string | null;
    price: number | null;
    is_active: boolean;
    created_at: string;
}

interface PageProps extends Record<string, unknown> {
    services: Service[];
    activity_logs: ActivityEntry[];
    auth: { user: { name: string } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtPrice = (p: number | null) => p == null ? 'Contact us' : `$${p.toFixed(2)}`;

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
    const { services, activity_logs, auth } = usePage<PageProps>().props;

    const activeServices = services.filter(s => s.is_active);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="flex flex-col gap-8 p-6">

                {/* ── Welcome header ──────────────────────────────────────── */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="rounded-xl bg-primary/10 p-3">
                                <Sparkles className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">
                                    Welcome back, {auth.user.name}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Explore our services and manage your account below.
                                </p>
                            </div>
                        </div>
                        <Link href="/orders/create"
                            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                            <ShoppingCart className="h-4 w-4" />New Order
                        </Link>
                    </div>
                </div>

                {/* ── Services + quick links ──────────────────────────────── */}
                <div className="grid gap-6 lg:grid-cols-3">

                    {/* Services grid */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card lg:col-span-2">
                        <div className="flex items-center justify-between border-b p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-primary/10 p-2.5">
                                    <Package className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">Available Services</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {activeServices.length} service{activeServices.length !== 1 ? 's' : ''} available
                                    </p>
                                </div>
                            </div>
                            <Link href="/services"
                                className="flex items-center gap-1 text-sm text-primary hover:underline">
                                Browse all <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </div>

                        {activeServices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                                <Package className="h-10 w-10 text-muted-foreground/30" />
                                <p className="font-medium">No services available</p>
                                <p className="text-sm text-muted-foreground">
                                    Check back soon — new services are being added.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-px bg-sidebar-border/30 sm:grid-cols-2">
                                {activeServices.map((svc) => (
                                    <div key={svc.id}
                                        className="flex flex-col gap-3 bg-card p-5 transition hover:bg-muted/30">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="rounded-lg bg-primary/10 p-2">
                                                <Package className="h-4 w-4 text-primary" />
                                            </div>
                                            <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                                                <CheckCircle2 className="h-3 w-3" />Available
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold">{svc.name}</p>
                                            {svc.description && (
                                                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                                                    {svc.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono text-sm font-semibold">
                                                {fmtPrice(svc.price)}
                                            </span>
                                            <Link href={`/services/${svc.id}`}
                                                className="flex items-center gap-1 rounded-lg border border-sidebar-border/70 px-3 py-1.5 text-xs font-medium transition hover:bg-accent/50">
                                                Learn more <ArrowUpRight className="h-3 w-3" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right column */}
                    <div className="flex flex-col gap-4">

                        {/* Quick links */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card">
                            <div className="border-b p-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2.5">
                                        <Settings className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold">Quick Links</h2>
                                        <p className="text-sm text-muted-foreground">Common shortcuts</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1 p-4">
                                {[
                                    { icon: ShoppingCart, label: 'My Orders',     href: '/orders' },
                                    { icon: Clock,        label: 'Order History', href: '/orders/history' },
                                    { icon: Settings,     label: 'My Account',    href: '/settings/profile' },
                                ].map(({ icon: Icon, label, href }) => (
                                    <Link key={label} href={href}
                                        className="flex items-center gap-3 rounded-lg p-2.5 transition hover:bg-accent/50">
                                        <div className="rounded-md bg-primary/10 p-2">
                                            <Icon className="h-4 w-4 text-primary" />
                                        </div>
                                        <span className="text-sm">{label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Service count summary */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card p-5">
                            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Service Summary
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Total available</span>
                                    <span className="font-semibold">{activeServices.length}</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full rounded-full bg-primary transition-all"
                                        style={{
                                            width: services.length
                                                ? `${(activeServices.length / services.length) * 100}%`
                                                : '0%',
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {activeServices.length} of {services.length} services active
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Personal activity log ───────────────────────────────── */}
                <ActivityFeed
                    logs={activity_logs}
                    showCauser={false}
                    title="My Recent Activity"
                    limit={10}
                />

            </div>
        </AppLayout>
    );
}
