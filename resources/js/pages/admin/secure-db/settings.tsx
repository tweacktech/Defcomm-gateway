import { Head, router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import { SecureDbNav, secureDbBreadcrumbs } from './_shared';

interface Settings {
    default_algorithm: string;
    rotation_frequency: string;
    retention_period_days: number;
    audit_retention_days: number;
    notification_channels: string[];
}

export default function SecureDbSettings() {
    const { settings } = usePage<{ settings: Settings }>().props;
    const [form, setForm] = useState(settings);

    return (
        <AppLayout breadcrumbs={secureDbBreadcrumbs('Settings')}>
            <Head title="Secure DB — Settings" />
            <div className="flex flex-col gap-6 p-6">
                <SecureDbNav />
                <h1 className="text-xl font-bold">Settings</h1>

                <div className="rounded-xl border border-sidebar-border/70 bg-card p-6 max-w-lg space-y-4">
                    <div><Label>Default Encryption Algorithm</Label>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" value={form.default_algorithm} onChange={e => setForm({ ...form, default_algorithm: e.target.value })}>
                            {['aes-256-gcm', 'chacha20-poly1305', 'rsa-4096-hybrid'].map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div><Label>Rotation Frequency</Label>
                        <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" value={form.rotation_frequency} onChange={e => setForm({ ...form, rotation_frequency: e.target.value })}>
                            {['5_minutes', 'hourly', 'daily', 'weekly', 'custom'].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <div><Label>Retention Period (days)</Label><Input type="number" value={form.retention_period_days} onChange={e => setForm({ ...form, retention_period_days: +e.target.value })} /></div>
                    <div><Label>Audit Retention (days)</Label><Input type="number" value={form.audit_retention_days} onChange={e => setForm({ ...form, audit_retention_days: +e.target.value })} /></div>
                    <div><Label>Notification Channels</Label>
                        <div className="flex gap-3 mt-2">
                            {['in_app', 'email', 'sms'].map(ch => (
                                <label key={ch} className="flex items-center gap-1.5 text-sm">
                                    <input type="checkbox" checked={form.notification_channels.includes(ch)}
                                        onChange={e => setForm({ ...form, notification_channels: e.target.checked ? [...form.notification_channels, ch] : form.notification_channels.filter(c => c !== ch) })} />
                                    {ch}
                                </label>
                            ))}
                        </div>
                    </div>
                    <Button onClick={() => router.patch('/admin/secure-db/settings', form)}>Save Settings</Button>
                </div>
            </div>
        </AppLayout>
    );
}
