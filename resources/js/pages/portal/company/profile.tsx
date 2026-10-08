import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';

export default function ProfilePage({ basePath = '/company/profile' }: { basePath?: string }) {
    const { user } = usePage<{ user: any } & Record<string, unknown>>().props;
    const [form, setForm] = useState({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        password: '',
        password_confirmation: '',
    });

    return (
        <AppLayout breadcrumbs={[{ title: 'Dashboard', href: '/dashboard' }, { title: 'Profile', href: basePath }]}>
            <Head title="Profile" />
            <div className="mx-auto w-full max-w-xl space-y-4 p-6">
                <h1 className="text-2xl font-bold">Profile</h1>
                <div className="rounded-xl border bg-card p-6 space-y-4">
                    <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                    <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label>New password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                    <div><Label>Confirm password</Label><Input type="password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} /></div>
                    <Button onClick={() => router.patch(basePath, form)}>Save profile</Button>
                </div>
            </div>
        </AppLayout>
    );
}
