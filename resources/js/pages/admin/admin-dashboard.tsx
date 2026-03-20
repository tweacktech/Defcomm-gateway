import { Head, Link, usePage } from '@inertiajs/react';
import {
    Users, ShoppingCart, TrendingUp, Settings, Package,
    AlertCircle, ArrowUpRight, CheckCircle2, XCircle,
    ToggleRight, UserCheck, UserX, ShieldCheck, UserPlus,
} from 'lucide-react';
import { ActivityFeed, type ActivityEntry } from '@/components/activity-feed';
import AppLayout from '@/layouts/app-layout';
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

interface AdminStats {
    total_services: number;
    active_services: number;
    total_users?: number;
    total_orders?: number;
}

interface UserSummary {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    new_this_week: number;
}

interface PageProps extends Record<string, unknown> {
    services: Service[];
    stats: AdminStats;
    user_summary: UserSummary;
    activity_logs: ActivityEntry[];
    auth: { user: { name: string } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtPrice = (p: number | null) => p == null ? '—' : `$${p.toFixed(2)}`;
const fmtDate  = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

// ─── Users Summary Card ───────────────────────────────────────────────────────

function UserSummaryCard({ summary }: { summary: UserSummary }) {
    const rows = [
        { label: 'Active accounts',   value: summary.active,        icon: UserCheck,   color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10'  },
        { label: 'Inactive accounts', value: summary.inactive,      icon: UserX,       color: 'text-red-500 dark:text-red-400',      bg: 'bg-red-500/10'    },
        { label: 'Admin users',       value: summary.admins,        icon: ShieldCheck, color: 'text-primary',                        bg: 'bg-primary/10'    },
        { label: 'New this week',     value: summary.new_this_week, icon: UserPlus,    color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/10'   },
    ];

    const activePct = summary.total > 0
        ? Math.round((summary.active / summary.total) * 100)
        : 0;

    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card">
            <div className="flex items-center justify-between border-b p-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Users</h2>
                        <p className="text-sm text-muted-foreground">
                            {summary.total} registered account{summary.total !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <Link href="/admin/users"
                    className="flex items-center gap-1 text-sm text-primary hover:underline">
                    Manage <ArrowUpRight className="h-4 w-4" />
                </Link>
            </div>

            <div className="divide-y divide-sidebar-border/40 px-6">
                {rows.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-2.5">
                            <div className={`rounded-md p-1.5 ${bg}`}>
                                <Icon className={`h-3.5 w-3.5 ${color}`} />
                            </div>
                            <span className="text-sm text-muted-foreground">{label}</span>
                        </div>
                        <span className={`text-sm font-semibold ${color}`}>{value}</span>
                    </div>
                ))}
            </div>

            <div className="border-t border-sidebar-border/40 p-5">
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Active rate</span>
                    <span className="font-medium">{activePct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${activePct}%` }} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                    {summary.active} of {summary.total} accounts currently active
                </p>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const { services, stats, user_summary, activity_logs, auth } = usePage<PageProps>().props;

    const overviewCards = [
        { title: 'Total Services',  value: stats.total_services,  sub: `${stats.active_services} active`,                                icon: Package,     color: 'bg-primary'    },
        { title: 'Active Services', value: stats.active_services, sub: `${stats.total_services - stats.active_services} inactive`,       icon: ToggleRight, color: 'bg-green-500'  },
        { title: 'Total Users',     value: stats.total_users ?? '—', sub: 'registered accounts',                                        icon: Users,       color: 'bg-blue-500'   },
        { title: 'Total Orders',    value: stats.total_orders ?? '—', sub: 'all time',                                                   icon: ShoppingCart,color: 'bg-purple-500' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Admin Dashboard" />

            <div className="flex flex-col gap-8 p-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
                        <p className="text-muted-foreground">
                            Welcome back, {auth.user.name}. Here's what's happening.
                        </p>
                    </div>
                    <Link href="/admin/services"
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                        <Package className="h-4 w-4" />New Service
                    </Link>
                </div>

                {/* Stat cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {overviewCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div key={card.title}
                                className="rounded-xl border border-sidebar-border/70 bg-card p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                                        <p className="text-2xl font-bold">{card.value}</p>
                                    </div>
                                    <div className={`rounded-lg ${card.color} p-2.5 text-white`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </div>
                                <p className="mt-3 text-sm text-muted-foreground">{card.sub}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Services table + right column */}
                <div className="grid gap-6 lg:grid-cols-3">

                    {/* Services table */}
                    <div className="rounded-xl border border-sidebar-border/70 bg-card lg:col-span-2">
                        <div className="flex items-center justify-between border-b p-6">
                            <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-primary/10 p-2.5">
                                    <Package className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">All Services</h2>
                                    <p className="text-sm text-muted-foreground">
                                        {services.length} service{services.length !== 1 ? 's' : ''} configured
                                    </p>
                                </div>
                            </div>
                            <Link href="/services"
                                className="flex items-center gap-1 text-sm text-primary hover:underline">
                                Manage <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </div>

                        {services.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                                <Package className="h-10 w-10 text-muted-foreground/30" />
                                <p className="font-medium">No services yet</p>
                                <Link href="/services/create"
                                    className="mt-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                                    Create Service
                                </Link>
                            </div>
                        ) : (
                            <div className="overflow-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left">
                                            {['Name', 'Description', 'Price', 'Status', 'Created', ''].map(h => (
                                                <th key={h} className="px-6 pb-3 pt-4 font-medium text-muted-foreground">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {services.map((svc) => (
                                            <tr key={svc.id}
                                                className="border-b last:border-0 transition hover:bg-muted/30">
                                                <td className="px-6 py-3 font-medium">{svc.name}</td>
                                                <td className="max-w-[180px] truncate px-6 py-3 text-muted-foreground">{svc.description ?? '—'}</td>
                                                <td className="px-6 py-3 font-mono">{fmtPrice(svc.price)}</td>
                                                <td className="px-6 py-3">
                                                    {svc.is_active
                                                        ? <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />Active</span>
                                                        : <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="h-3.5 w-3.5" />Inactive</span>}
                                                </td>
                                                <td className="px-6 py-3 text-muted-foreground">{fmtDate(svc.created_at)}</td>
                                                <td className="px-6 py-3">
                                                    {/* <Link href={`admin/services?$search=${svc.id}/edit`}
                                                        className="text-xs text-primary hover:underline">Edit</Link> */}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Right column */}
                    <div className="flex flex-col gap-4">
                        {/* Users summary card */}
                        <UserSummaryCard summary={user_summary} />

                        {/* Quick actions */}
                        <div className="rounded-xl border border-sidebar-border/70 bg-card">
                            <div className="border-b p-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-lg bg-primary/10 p-2.5">
                                        <Settings className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold">Quick Actions</h2>
                                        <p className="text-sm text-muted-foreground">Admin shortcuts</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1 p-4">
                                {[
                                    { icon: Package,      label: 'Manage service', href: '/admin/services' },
                                    { icon: Users,        label: 'Manage users',       href: '/admin/users' },
                                    { icon: ShoppingCart, label: 'View all orders',    href: '/orders' },
                                    { icon: TrendingUp,   label: 'View reports',       href: '/reports' },
                                    { icon: Settings,     label: 'System settings',    href: '/settings/profile' },
                                ].map(({ icon: Icon, label, href }) => (
                                    <Link key={label} href={href}
                                        className="flex w-full items-center gap-3 rounded-lg p-2.5 transition hover:bg-accent/50">
                                        <div className="rounded-md bg-primary/10 p-2">
                                            <Icon className="h-4 w-4 text-primary" />
                                        </div>
                                        <span className="text-sm">{label}</span>
                                    </Link>
                                ))}
                                <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                                        <div>
                                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Admin access active</p>
                                            <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-400">You have full control over this platform.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Activity log */}
                <ActivityFeed
                    logs={activity_logs}
                    showCauser={true}
                    title="Platform Activity"
                    limit={15}
                />
            </div>
        </AppLayout>
    );
}
