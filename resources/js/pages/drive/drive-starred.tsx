import { Head, usePage, router } from '@inertiajs/react';
import {
    Star, Folder, File, FileText, FileImage, FileVideo, FileAudio,
    Home, Grid3x3, List, Search, HardDrive, Trash2, Shield,
    Download, Lock, Globe, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Visibility  = 'private' | 'public';
type DisplayMode = 'grid' | 'list';

interface DriveItem {
    id: number;
    parent_id: number | null;
    type: 'folder' | 'file';
    name: string;
    mime_type?: string | null;
    size: number;
    extension?: string | null;
    is_starred: boolean;
    visibility: Visibility;
    created_at: string;
    updated_at: string;
}

type PageProps = {
    items: DriveItem[];
    usage: number;
    storage_limit: number;
    auth: { user: { id: number; name: string } };
} & Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtSize = (bytes: number) => {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtUsage = (bytes: number) => {
    const gb = bytes / 1024 ** 3;
    return gb < 0.01 ? `${(bytes / 1024 ** 2).toFixed(1)} MB` : `${gb.toFixed(2)} GB`;
};

function FileIcon({ item, size = 4 }: { item: DriveItem; size?: number }) {
    const cls = `h-${size} w-${size}`;
    if (item.type === 'folder') return <Folder className={`${cls} text-yellow-400`} />;
    const mime = item.mime_type ?? '';
    if (mime.startsWith('image/'))  return <FileImage className={`${cls} text-blue-400`} />;
    if (mime.startsWith('video/'))  return <FileVideo className={`${cls} text-purple-400`} />;
    if (mime.startsWith('audio/'))  return <FileAudio className={`${cls} text-pink-400`} />;
    if (mime.includes('pdf'))       return <FileText className={`${cls} text-red-400`} />;
    if (mime.includes('text') || ['md','txt','csv'].includes(item.extension ?? ''))
                                    return <FileText className={`${cls} text-green-400`} />;
    return <File className={`${cls} text-muted-foreground`} />;
}

function VisibilityBadge({ v, small = false }: { v: Visibility; small?: boolean }) {
    const base = small
        ? 'flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded'
        : 'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap';
    return v === 'public' ? (
        <span className={`${base} bg-green-500/15 text-green-600 dark:text-green-400`}>
            <Globe className={small ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            {!small && 'Public'}
        </span>
    ) : (
        <span className={`${base} bg-muted/60 text-muted-foreground`}>
            <Lock className={small ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            {!small && 'Private'}
        </span>
    );
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Drive',   href: '/drive' },
    { title: 'Starred', href: '/drive/starred' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Starred() {
    const { items, usage, storage_limit } = usePage<PageProps>().props;

    const [display, setDisplay] = useState<DisplayMode>('grid');
    const [search, setSearch]   = useState('');

    const storageLimit = storage_limit ?? 2 * 1024 ** 3;
    const usagePct     = Math.min((usage / storageLimit) * 100, 100);

    const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
    const folders  = filtered.filter(i => i.type === 'folder');
    const files    = filtered.filter(i => i.type === 'file');

    const unstar = (id: number) =>
        router.patch(`/drive/items/${id}/star`, {}, { preserveScroll: true });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Starred — Drive" />

            <div className="flex flex-1 overflow-hidden">

                {/* ── Sidebar ─────────────────────────────────────────────── */}
                <aside className="hidden w-56 flex-shrink-0 flex-col gap-1 border-r border-sidebar-border/50 bg-card p-4 lg:flex">
                    {[
                        { label: 'My Drive', icon: HardDrive, href: '/drive',         active: false },
                        { label: 'Starred',  icon: Star,      href: '/drive/starred', active: true  },
                        { label: 'Trash',    icon: Trash2,    href: '/drive/trash',   active: false },
                    ].map(nav => (
                        <button key={nav.label} onClick={() => router.get(nav.href)}
                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition
                                ${nav.active
                                    ? 'bg-primary/10 font-medium text-primary'
                                    : 'text-muted-foreground hover:bg-accent/50'}`}>
                            <nav.icon className="h-4 w-4" />{nav.label}
                        </button>
                    ))}

                    <div className="mt-auto rounded-xl border border-sidebar-border/50 bg-muted/30 p-3">
                        <div className="mb-1.5 flex items-center justify-between">
                            <p className="text-xs font-medium">Storage</p>
                            <Shield className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full transition-all ${usagePct >= 95 ? 'bg-red-500' : usagePct >= 80 ? 'bg-yellow-500' : 'bg-primary'}`}
                                style={{ width: `${usagePct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {fmtUsage(usage)}<span className="text-muted-foreground/60"> / {fmtUsage(storageLimit)}</span>
                        </p>
                    </div>
                </aside>

                {/* ── Main ────────────────────────────────────────────────── */}
                <main className="flex flex-1 flex-col overflow-auto p-6">

                    {/* Header */}
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm">
                            <button onClick={() => router.get('/drive')}
                                className="text-muted-foreground hover:text-foreground">
                                <Home className="h-4 w-4" />
                            </button>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <div className="flex items-center gap-1.5 font-medium">
                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                Starred
                            </div>
                            <span className="text-muted-foreground">({items.length})</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Filter starred…" className="h-8 w-44 pl-7 text-xs" />
                            </div>
                            <div className="flex overflow-hidden rounded-lg border border-sidebar-border/50">
                                <button onClick={() => setDisplay('grid')}
                                    className={`p-2 transition ${display === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`}>
                                    <Grid3x3 className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setDisplay('list')}
                                    className={`p-2 transition ${display === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`}>
                                    <List className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Empty state */}
                    {items.length === 0 && (
                        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                            <Star className="h-14 w-14 text-muted-foreground/20" />
                            <p className="text-lg font-semibold">No starred items</p>
                            <p className="text-sm text-muted-foreground">
                                Right-click any file or folder and select Star to pin it here.
                            </p>
                            <button onClick={() => router.get('/drive')}
                                className="mt-2 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition">
                                <HardDrive className="h-4 w-4" />Browse My Drive
                            </button>
                        </div>
                    )}

                    {/* Folders section */}
                    {folders.length > 0 && (
                        <div className="mb-6">
                            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Folders
                            </p>
                            {display === 'grid' ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                    {folders.map(item => (
                                        <div key={item.id}
                                            onDoubleClick={() => router.get(`/drive/folder/${item.id}`)}
                                            className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-sidebar-border/50 bg-muted/20 p-4 transition hover:bg-muted/40 select-none">
                                            <FileIcon item={item} size={10} />
                                            <p className="w-full truncate text-center text-xs font-medium">{item.name}</p>
                                            <VisibilityBadge v={item.visibility} small />
                                            <button onClick={e => { e.stopPropagation(); unstar(item.id); }}
                                                className="absolute top-2 right-2 hidden rounded p-1 hover:bg-accent/80 group-hover:flex"
                                                title="Unstar">
                                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {folders.map(item => (
                                        <div key={item.id}
                                            onDoubleClick={() => router.get(`/drive/folder/${item.id}`)}
                                            className="group flex cursor-pointer items-center gap-3 rounded-lg border border-sidebar-border/50 bg-muted/20 px-4 py-3 transition hover:bg-muted/40 select-none">
                                            <FileIcon item={item} size={5} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{item.name}</p>
                                            </div>
                                            <VisibilityBadge v={item.visibility} />
                                            <span className="hidden text-xs text-muted-foreground sm:block w-28">
                                                {fmtDate(item.updated_at)}
                                            </span>
                                            <button onClick={() => unstar(item.id)}
                                                className="rounded p-1.5 opacity-0 transition hover:bg-accent/80 group-hover:opacity-100"
                                                title="Unstar">
                                                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Files section */}
                    {files.length > 0 && (
                        <div>
                            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Files
                            </p>
                            {display === 'grid' ? (
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                    {files.map(item => (
                                        <div key={item.id}
                                            className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-sidebar-border/50 bg-muted/20 p-4 transition hover:bg-muted/40 select-none">
                                            <FileIcon item={item} size={10} />
                                            <p className="w-full truncate text-center text-xs font-medium">{item.name}</p>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-muted-foreground">{fmtSize(item.size)}</span>
                                                <VisibilityBadge v={item.visibility} small />
                                            </div>
                                            <div className="absolute top-2 right-2 hidden items-center gap-0.5 group-hover:flex">
                                                <button onClick={() => window.open(`/drive/items/${item.id}/download`, '_blank')}
                                                    className="rounded p-1 hover:bg-accent/80" title="Download">
                                                    <Download className="h-3 w-3 text-muted-foreground" />
                                                </button>
                                                <button onClick={() => unstar(item.id)}
                                                    className="rounded p-1 hover:bg-accent/80" title="Unstar">
                                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <div className="mb-1 hidden grid-cols-[1fr_7rem_5rem_8rem_2rem] gap-3 px-4 text-xs font-medium text-muted-foreground sm:grid">
                                        <span>Name</span>
                                        <span>Visibility</span>
                                        <span className="text-right">Size</span>
                                        <span>Modified</span>
                                        <span />
                                    </div>
                                    <div className="space-y-1.5">
                                        {files.map(item => (
                                            <div key={item.id}
                                                className="group flex cursor-pointer items-center gap-3 rounded-lg border border-sidebar-border/50 bg-muted/20 px-4 py-3 transition hover:bg-muted/40 select-none">
                                                <FileIcon item={item} size={5} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium">{item.name}</p>
                                                    {item.extension && <p className="text-xs uppercase text-muted-foreground">{item.extension}</p>}
                                                </div>
                                                <VisibilityBadge v={item.visibility} />
                                                <span className="hidden w-16 text-right text-xs text-muted-foreground sm:block">
                                                    {fmtSize(item.size)}
                                                </span>
                                                <span className="hidden w-28 text-xs text-muted-foreground sm:block">
                                                    {fmtDate(item.updated_at)}
                                                </span>
                                                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                                                    <button onClick={() => window.open(`/drive/items/${item.id}/download`, '_blank')}
                                                        className="rounded p-1.5 hover:bg-accent/80" title="Download">
                                                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                                                    </button>
                                                    <button onClick={() => unstar(item.id)}
                                                        className="rounded p-1.5 hover:bg-accent/80" title="Unstar">
                                                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </AppLayout>
    );
}
