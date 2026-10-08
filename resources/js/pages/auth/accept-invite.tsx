import { Head, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

type Props = {
    token: string;
    email: string;
    organization: { id: number; name: string } | null;
    role: string;
    platform_role?: string | null;
    role_label?: string;
};

export default function AcceptInvite({ token, email, organization, role, role_label }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(`/invite/${token}`);
    };

    const description = organization
        ? `Join ${organization.name} as ${role_label || role}`
        : `Create your ${role_label || role} account`;

    return (
        <AuthLayout
            title="Set up your account"
            description={description}
        >
            <Head title="Accept invitation" />
            <form onSubmit={submit} className="flex flex-col gap-4">
                <div>
                    <Label>Email</Label>
                    <Input value={email} readOnly className="mt-1 bg-muted" />
                </div>
                <div>
                    <Label>Full name</Label>
                    <Input className="mt-1" value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                    {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
                </div>
                <div>
                    <Label>Password</Label>
                    <Input type="password" className="mt-1" value={data.password} onChange={(e) => setData('password', e.target.value)} required />
                    {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
                </div>
                <div>
                    <Label>Confirm password</Label>
                    <Input type="password" className="mt-1" value={data.password_confirmation} onChange={(e) => setData('password_confirmation', e.target.value)} required />
                </div>
                <Button type="submit" disabled={processing} className="w-full">
                    Activate account
                </Button>
            </form>
        </AuthLayout>
    );
}
