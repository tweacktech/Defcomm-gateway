import { Head, router, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

interface Notification {
    id: number; uuid: string; type: string; title: string; message: string;
    channel: string; is_read: boolean; created_at: string;
}

export default function SecureDbNotifications() {
    const { notifications } = usePage<{ notifications: { data: Notification[] } }>().props;

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Notifications')}>
            <Head title="Secure DB — Notifications" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />
                <h1 className="text-xl font-bold">Notifications</h1>
                <div className="space-y-3">
                    {notifications.data.map(n => (
                        <div key={n.id} className={`rounded-xl border p-4 ${n.is_read ? 'border-sidebar-border/40 opacity-60' : 'border-sidebar-border/70 bg-card'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-medium">{n.title}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                                    <p className="text-xs text-muted-foreground mt-2">{n.channel} · {n.type} · {n.created_at}</p>
                                </div>
                                {!n.is_read && (
                                    <button onClick={() => router.patch(`/admin/secure-db/notifications/${n.uuid}/read`)} className="text-xs text-primary hover:underline">Mark read</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
