// resources/js/pages/auth/register.tsx
import { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { OrganizationCombobox } from '@/components/organization-combobox';
import { login } from '@/routes';

// ─── Step indicator ──────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
    return (
        <div className="mb-6 flex items-center gap-3">
            {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                    <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                            s === step
                                ? 'bg-primary text-primary-foreground'
                                : s < step
                                ? 'bg-primary/30 text-primary'
                                : 'bg-muted text-muted-foreground'
                        }`}
                    >
                        {s}
                    </span>
                    <span
                        className={`text-sm ${
                            s === step ? 'font-medium' : 'text-muted-foreground'
                        }`}
                    >
                        {s === 1 ? 'Organization' : 'Your account'}
                    </span>
                    {s < 2 && <span className="mx-1 text-muted-foreground">›</span>}
                </div>
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Register() {
    const [step, setStep] = useState<1 | 2>(1);

    const { data, setData, post, processing, errors, reset } = useForm({
        // Step 1
        organization_id: null as number | null,
        organization_name: '',
        organization_email: '',
        // Step 2
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    // ── Step 1 validation (client-side guard before proceeding) ──
    const handleStep1Next = (e: React.FormEvent) => {
        e.preventDefault();
        if (!data.organization_name.trim()) return;
        setStep(2);
    };

    // ── Final submit ──
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/register', {
            onSuccess: () => reset('password', 'password_confirmation'),
        });
    };

    const stepTitle = step === 1 ? 'Set up your organization' : 'Create your account';
    const stepDesc =
        step === 1
            ? 'Search for your organization or create a new one'
            : 'Enter your personal details to finish registration';

    return (
        <AuthLayout title={stepTitle} description={stepDesc}>
            <Head title="Register" />

            <StepIndicator step={step} />

            {/* ── Step 1: Organization ────────────────────────────────── */}
            {step === 1 && (
                <form onSubmit={handleStep1Next} className="flex flex-col gap-6">
                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="organization_name">Organization name</Label>
                            <OrganizationCombobox
                                value={{
                                    id: data.organization_id,
                                    name: data.organization_name,
                                }}
                                onChange={({ id, name }) => {
                                    setData((prev) => ({
                                        ...prev,
                                        organization_id: id,
                                        organization_name: name,
                                    }));
                                }}
                                error={errors.organization_name}
                                tabIndex={1}
                            />
                            <InputError message={errors.organization_name} />
                        </div>

                        {/* Only ask for org email when creating a new org */}
                        {!data.organization_id && data.organization_name.trim().length > 0 && (
                            <div className="grid gap-2">
                                <Label htmlFor="organization_email">
                                    Organization email{' '}
                                    <span className="text-muted-foreground">(optional)</span>
                                </Label>
                                <Input
                                    id="organization_email"
                                    type="email"
                                    tabIndex={2}
                                    autoComplete="organization email"
                                    placeholder="org@example.com"
                                    value={data.organization_email}
                                    onChange={(e) =>
                                        setData('organization_email', e.target.value)
                                    }
                                />
                                <InputError message={errors.organization_email} />
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="mt-2 w-full"
                            tabIndex={3}
                            disabled={!data.organization_name.trim()}
                        >
                            Continue
                        </Button>
                    </div>

                    <div className="text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <TextLink href={login()} tabIndex={4}>
                            Log in
                        </TextLink>
                    </div>
                </form>
            )}

            {/* ── Step 2: User details ─────────────────────────────────── */}
            {step === 2 && (
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    {/* Summary of selected org */}
                    <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Organization:</span>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{data.organization_name}</span>
                            {data.organization_id && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                    Existing
                                </span>
                            )}
                            {!data.organization_id && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    New
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="ml-2 text-xs text-primary underline"
                        >
                            Change
                        </button>
                    </div>

                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Full name</Label>
                            <Input
                                id="name"
                                type="text"
                                required
                                autoFocus
                                tabIndex={1}
                                autoComplete="name"
                                placeholder="Jane Smith"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                            />
                            <InputError message={errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                tabIndex={2}
                                autoComplete="email"
                                placeholder="jane@example.com"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                            />
                            <InputError message={errors.email} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                tabIndex={3}
                                autoComplete="new-password"
                                placeholder="Password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                            />
                            <InputError message={errors.password} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password_confirmation">Confirm password</Label>
                            <Input
                                id="password_confirmation"
                                type="password"
                                required
                                tabIndex={4}
                                autoComplete="new-password"
                                placeholder="Confirm password"
                                value={data.password_confirmation}
                                onChange={(e) =>
                                    setData('password_confirmation', e.target.value)
                                }
                            />
                            <InputError message={errors.password_confirmation} />
                        </div>

                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                tabIndex={5}
                                onClick={() => setStep(1)}
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                className="w-full"
                                tabIndex={6}
                                disabled={processing}
                                data-test="register-user-button"
                            >
                                {processing && <Spinner />}
                                Create account
                            </Button>
                        </div>
                    </div>

                    <div className="text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <TextLink href={login()} tabIndex={7}>
                            Log in
                        </TextLink>
                    </div>
                </form>
            )}
        </AuthLayout>
    );
}
