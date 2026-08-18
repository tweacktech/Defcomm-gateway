import type { LucideIcon } from 'lucide-react';
import {
    LayoutDashboard, FolderKanban, Database, Shield, KeyRound,
    MonitorSmartphone, ScrollText, Bell, BarChart3, Settings, Puzzle,
} from 'lucide-react';
import type { BreadcrumbItem } from '@/types';

export const secureDbNavItems: { title: string; href: string; icon: LucideIcon }[] = [
    { title: 'Dashboard', href: '/admin/secure-db', icon: LayoutDashboard },
    { title: 'Projects', href: '/admin/secure-db/projects', icon: FolderKanban },
    { title: 'Connections', href: '/admin/secure-db/connections', icon: Database },
    { title: 'Secure Widget', href: '/admin/secure-db/secure-widget', icon: Puzzle },
    { title: 'Policies', href: '/admin/secure-db/policies', icon: Shield },
    { title: 'Keys', href: '/admin/secure-db/keys', icon: KeyRound },
    { title: 'Devices', href: '/admin/secure-db/devices', icon: MonitorSmartphone },
    { title: 'Audit Logs', href: '/admin/secure-db/audit-logs', icon: ScrollText },
    { title: 'Notifications', href: '/admin/secure-db/notifications', icon: Bell },
    { title: 'Reports', href: '/admin/secure-db/reports', icon: BarChart3 },
    { title: 'Settings', href: '/admin/secure-db/settings', icon: Settings },
];

export const secureDbBreadcrumbs = (page: string): BreadcrumbItem[] => [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Secure DB', href: '/admin/secure-db' },
    { title: page, href: '#' },
];

export function StatCard({ label, value, icon: Icon, accent = 'text-primary' }: {
    label: string; value: string | number; icon: LucideIcon; accent?: string;
}) {
    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card p-5">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-bold">{value}</p>
                </div>
                <div className={`rounded-lg bg-primary/10 p-2.5 ${accent}`}>
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

export function MiniChart({ data, label, color = 'bg-primary' }: {
    data: Record<string, number>; label: string; color?: string;
}) {
    const entries = Object.entries(data);
    const max = Math.max(...entries.map(([, v]) => v), 1);

    return (
        <div className="rounded-xl border border-sidebar-border/70 bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold">{label}</h3>
            {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
                <div className="flex items-end gap-1 h-24">
                    {entries.map(([date, count]) => (
                        <div key={date} className="flex flex-1 flex-col items-center gap-1">
                            <div
                                className={`w-full rounded-t ${color} opacity-80`}
                                style={{ height: `${Math.max((count / max) * 100, 4)}%` }}
                                title={`${date}: ${count}`}
                            />
                            <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                                {date.slice(5)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function SecureDbNav() {
    return (
        <nav className="flex flex-wrap gap-1 border-b border-sidebar-border/70 pb-4">
            {secureDbNavItems.map(({ title, href, icon: Icon }) => (
                <a
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                    <Icon className="h-3.5 w-3.5" />
                    {title}
                </a>
            ))}
        </nav>
    );
}
