import { Head, Link, usePage } from '@inertiajs/react';
import { Shield, BadgeCheck, Cpu, Lock, MoreVertical, ChevronDown, Wifi, Fingerprint, MonitorSmartphone, Package } from 'lucide-react';
import { dashboard, login, register } from '@/routes';

export default function Welcome({
    canRegister = true,
}: {
    canRegister?: boolean;
}) {
    const { auth } = usePage<{
        auth: { user: unknown } | null;
    }>().props;
    const isAuthenticated = Boolean(auth && auth.user);

    return (
        <>
            <Head title="Welcome" />
            <div className="relative flex min-h-svh flex-col overflow-hidden bg-black text-white">

                {/* === BACKGROUND === */}
                {/* Deep olive radial at bottom */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(74,90,30,0.55),transparent_70%)]" />
                {/* Subtle top-left vignette */}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_0%_0%,rgba(20,30,10,0.8),transparent)]" />

                {/* Left panel grid */}
                <div className="pointer-events-none absolute top-[5.5rem] left-0 h-[420px] w-[55%]">
                    {/* Outer border rectangle */}
                    <div className="absolute inset-4 border border-white/[0.07]" />
                    {/* Inner dark rectangle (bottom-right quadrant) */}
                    <div className="absolute top-[38%] left-[30%] right-[12%] bottom-[4px] bg-white/[0.025] border border-white/[0.06]" />
                    {/* Grid lines */}
                    <div
                        className="absolute inset-4"
                        style={{
                            backgroundImage:
                                'linear-gradient(to right, rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.055) 1px, transparent 1px)',
                            backgroundSize: '160px 130px',
                        }}
                    />
                </div>

                {/* === HEADER === */}
                <header className="relative z-20 flex items-center justify-between px-8 py-5">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/20 bg-white/5">
                            <Shield className="h-5 w-5 text-white" />
                        </div>
                    </div>
                    {/* Three-dot menu */}
                    <button className="flex h-8 w-8 items-center justify-center rounded text-white/60 hover:text-white">
                        <MoreVertical className="h-5 w-5" />
                    </button>
                </header>

                {/* === HERO ZONE === */}
                <div className="relative z-10 flex flex-1 flex-col">
                    {/* Main row: diagram area + login card */}
                    <div className="relative flex flex-1 items-center px-8 pb-4">

                        {/* Left: annotated diagram labels */}
                        <div className="relative flex-1 self-stretch">
                            {/* Killer Switch annotation */}
                            <div className="absolute top-[22%] left-[36%]">
                                <p className="text-[11px] text-white/70 tracking-wide">Killer Switch</p>
                                {/* Leader line */}
                                <svg
                                    className="absolute top-4 left-8 overflow-visible"
                                    width="200" height="80"
                                    viewBox="0 0 200 80"
                                    fill="none"
                                >
                                    <polyline
                                        points="0,0 80,0 160,70"
                                        stroke="rgba(255,255,255,0.35)"
                                        strokeWidth="0.8"
                                        fill="none"
                                    />
                                    <circle cx="160" cy="70" r="2.5" fill="white" fillOpacity="0.6" />
                                </svg>
                            </div>

                            {/* USB Detectors annotation */}
                            <div className="absolute top-[52%] left-[26%]">
                                <p className="text-[11px] text-white/70 tracking-wide">USB Detectors Automatic</p>
                                <p className="text-[11px] text-white/70 tracking-wide">Wipes With Foreign Elements</p>
                                {/* Leader line going up-right */}
                                <svg
                                    className="absolute -top-8 left-36 overflow-visible"
                                    width="120" height="60"
                                    viewBox="0 0 120 60"
                                    fill="none"
                                >
                                    <polyline
                                        points="0,60 60,30 120,0"
                                        stroke="rgba(255,255,255,0.35)"
                                        strokeWidth="0.8"
                                        fill="none"
                                    />
                                    <circle cx="120" cy="0" r="2.5" fill="white" fillOpacity="0.6" />
                                </svg>
                            </div>
                        </div>

                        {/* Center-Right: Login Card */}
                        <div className="relative w-full max-w-sm flex-shrink-0">
                            <div className="rounded-2xl bg-white px-8 py-8 shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
                                <h2 className="mb-6 text-center text-[15px] font-semibold text-gray-900">
                                    Sign in With Defcomm account
                                </h2>

                                {/* Phone input */}
                                <div className="mb-4 flex items-center gap-0 overflow-hidden rounded-md border border-gray-200 bg-white">
                                    {/* Nigeria flag */}
                                    <div className="flex items-center gap-1.5 border-r border-gray-200 bg-gray-50 px-3 py-2.5">
                                        <span className="text-base leading-none">🇳🇬</span>
                                        <ChevronDown className="h-3 w-3 text-gray-400" />
                                    </div>
                                    <input
                                        type="tel"
                                        defaultValue="+234"
                                        className="flex-1 bg-transparent px-3 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400"
                                    />
                                </div>

                                {/* Remember me + Forgot */}
                                <div className="mb-5 flex items-center justify-between">
                                    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gray-600">
                                        <input
                                            type="checkbox"
                                            className="h-3.5 w-3.5 rounded border-gray-300 accent-[#5a7a00]"
                                        />
                                        Remember me
                                    </label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-[12px] font-medium text-[#6b8c00] hover:underline"
                                    >
                                        Forgot Password?
                                    </Link>
                                </div>

                                {/* Login button */}
                                <Link
                                    href={isAuthenticated ? dashboard() : login()}
                                    className="flex h-11 w-full items-center justify-center rounded-md bg-[#4a5c10] text-[13px] font-semibold uppercase tracking-widest text-white shadow-[0_8px_24px_rgba(74,92,16,0.5)] transition hover:bg-[#5a7014]"
                                >
                                    Login
                                </Link>

                                {/* QR scan */}
                                <p className="mt-4 text-center text-[12px] text-gray-500">
                                    Prefer QR scan instead?
                                </p>
                            </div>
                        </div>

                        {/* Right side annotations */}
                        <div className="relative ml-8 flex w-40 flex-shrink-0 flex-col items-end gap-8 self-stretch">
                            {/* Circular badge */}
                            <div className="relative mt-4 flex h-16 w-16 items-center justify-center self-end">
                                <div className="absolute inset-0 rounded-full border border-[#5a7a00]/60 bg-[#1a2208]/80" />
                                {/* Rotating text path simulation */}
                                <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full animate-[spin_18s_linear_infinite]">
                                    <defs>
                                        <path id="circle-path" d="M 32,32 m -22,0 a 22,22 0 1,1 44,0 a 22,22 0 1,1 -44,0" />
                                    </defs>
                                    <text fontSize="5.5" fill="rgba(180,210,80,0.7)" letterSpacing="2.2" fontFamily="monospace">
                                        <textPath href="#circle-path">ABSOLUTE · PRIVACY ·</textPath>
                                    </text>
                                </svg>
                                <ChevronDown className="relative z-10 h-4 w-4 text-white/80" />
                            </div>

                            {/* TPM annotation */}
                            <div className="mt-auto text-right">
                                {/* Leader line from left */}
                                <svg className="mb-1 ml-auto" width="120" height="24" viewBox="0 0 120 24" fill="none">
                                    <line x1="0" y1="12" x2="120" y2="12" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                                    <circle cx="0" cy="12" r="2" fill="white" fillOpacity="0.5" />
                                </svg>
                                <p className="text-[9px] leading-relaxed text-white/55">
                                    Built-In TPM Chips Provide Hardware-Based<br />
                                    Cryptographic Functions, Secure Key Storage.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* === BOTTOM HERO TEXT === */}
                    <div className="px-8 pb-6 text-center">
                        <h1 className="mb-2 text-4xl font-bold tracking-tight text-white">
                            3<span className="text-[#e07b00]">6</span>0 Degree Protection
                        </h1>
                        <p className="mx-auto max-w-xs text-[12px] leading-relaxed text-white/60">
                            Defcomm Technology Solution is producing secure and<br />
                            Encrypted Embedded Technology with the secure<br />
                            chips.
                        </p>
                    </div>

                    {/* === FOOTER === */}
                    <footer className="relative z-20 border-t border-white/[0.07] px-8 py-4">
                        <div className="flex items-center justify-between">
                            {/* Left: icon buttons */}
                            <div className="flex items-center gap-2">
                                {[
                                    { icon: Shield, active: false },
                                    { icon: Fingerprint, active: true },
                                    { icon: MonitorSmartphone, active: false },
                                    { icon: Package, active: false },
                                    { icon: Wifi, active: false },
                                ].map(({ icon: Icon, active }, i) => (
                                    <button
                                        key={i}
                                        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                                            active
                                                ? 'border-white/20 bg-white/10 text-white'
                                                : 'border-white/[0.08] bg-white/[0.04] text-white/50 hover:text-white/80'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </button>
                                ))}
                            </div>

                            {/* Center: logo + brand + nav */}
                            <div className="flex items-center gap-8">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded border border-white/20 bg-white/5">
                                        <Shield className="h-4 w-4 text-white" />
                                    </div>
                                    <span className="text-[13px] font-bold uppercase tracking-widest text-white">
                                        DEFCOMM
                                    </span>
                                </div>
                                <nav className="flex items-center gap-6 text-[11px] text-white/60">
                                    <button className="underline underline-offset-2 hover:text-white">PRODUCT</button>
                                    <button className="underline underline-offset-2 hover:text-white">SUPPORT</button>
                                    <button className="underline underline-offset-2 hover:text-white">COOPERATION</button>
                                </nav>
                            </div>

                            {/* Right: copyright + scroll button */}
                            <div className="flex items-center gap-4">
                                <p className="text-[10px] text-white/40">
                                    © Copyright Defcomm, All Rights Reserved.
                                </p>
                                <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[#5a7a00]/60 bg-transparent text-[#8aaa20] hover:bg-[#5a7a00]/20 transition">
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>
        </>
    );
}
