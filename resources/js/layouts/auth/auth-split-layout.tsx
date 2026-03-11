import { Link, usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import type { AuthLayoutProps } from '@/types';
import { home } from '@/routes';

export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { name } = usePage().props;

    return (
        <div className="flex min-h-svh w-full items-center justify-center bg-linear-to-b from-[#0b1a08] via-[#050b04] to-black px-4 py-10 sm:px-6 lg:px-10">
            <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-2">
                {/* Left branding panel */}
                <div className="relative hidden overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-white/10 via-white/5 to-transparent p-10 text-white shadow-[0_24px_80px_rgba(0,0,0,0.8)] lg:flex lg:flex-col">
                    <div className="pointer-events-none absolute inset-0 opacity-25">
                        <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.35),transparent_55%),radial-gradient(circle_at_bottom,rgba(34,197,94,0.4),transparent_55%)]" />
                        <div className="absolute inset-10 -z-10 bg-[linear-gradient(to_right,rgba(148,163,184,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.15)_1px,transparent_1px)] bg-size-[80px_80px]" />
                    </div>

                    <div className="relative z-10 flex flex-1 flex-col justify-between">
                        <div className="flex items-center gap-3">
                            <Link
                                href={home()}
                                className="inline-flex items-center text-lg font-semibold tracking-tight"
                            >
                                <AppLogoIcon className="mr-2 size-8 fill-current text-white" />
                                <span className="text-sm font-medium uppercase tracking-[0.28em] text-emerald-200/90">
                                    {name}
                                </span>
                            </Link>
                        </div>

                        <div className="mt-10 max-w-xs">
                            <p className="text-sm font-medium uppercase tracking-[0.28em] text-emerald-300/90">
                                Redefining Defence, Communication
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right auth card */}
                <div className="flex items-center justify-center">
                    <div className="w-full max-w-md rounded-3xl bg-background/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-md sm:p-8">
                        <div className="mb-6 flex flex-col gap-3 text-center">
                            <div className="flex items-center justify-center gap-2 lg:hidden">
                                <Link
                                    href={home()}
                                    className="inline-flex items-center gap-2"
                                >
                                    <AppLogoIcon className="h-8 w-8 fill-current text-foreground" />
                                    {name && (
                                        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                            {name}
                                        </span>
                                    )}
                                </Link>
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
                                    {title}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    {description}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-6">{children}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
