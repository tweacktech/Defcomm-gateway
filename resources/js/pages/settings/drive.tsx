import { Head, usePage, router } from '@inertiajs/react';
import {
    Folder, FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
    FilePlus, FolderPlus, Upload, Download, Star, Trash2, RotateCcw,
    Pencil, X, Check, ChevronRight, Home, MoreVertical, Grid3x3,
    List, Search, HardDrive, AlertCircle, Move,
} from 'lucide-react';
import { useState, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriveItem {
    id: number;
    parent_id: number | null;
    type: 'folder' | 'file';
    name: string;
    mime_type?: string | null;
    size: number;
    extension?: string | null;
    is_starred: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

interface FolderNode {
    id: number;
    name: string;
    parent_id: number | null;
}

interface BreadcrumbNode {
    id: number;
    name: string;
}

type ViewMode = 'my-drive' | 'starred' | 'trash';
type DisplayMode = 'grid' | 'list';

type PageProps = {
    folder: FolderNode | null;
    items: DriveItem[];
    breadcrumbs: BreadcrumbNode[];
    usage: number;
    view?: ViewMode;
    auth: { user: unknown };
} & Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const fmtSize = (bytes: number): string => {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

const fmtUsage = (bytes: number): string => {
    const gb = bytes / (1024 ** 3);
    return gb < 0.01 ? `${(bytes / (1024 ** 2)).toFixed(1)} MB` : `${gb.toFixed(2)} GB`;
};

// Map extension/mime to icon component
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

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameModal({ item, onClose }: { item: DriveItem; onClose: () => void }) {
    const [name, setName] = useState(item.name);
    const [saving, setSaving] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.select(); }, []);

    const submit = () => {
        if (!name.trim() || name === item.name) { onClose(); return; }
        setSaving(true);
        router.patch(`/drive/items/${item.id}/rename`, { name }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: () => setSaving(false),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">Rename</h3>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <Input ref={ref} value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
                    className="mb-4 text-sm" />
                <div className="flex gap-3">
                    <Button onClick={submit} disabled={!name.trim() || saving} className="gap-2">
                        {saving ? 'Saving…' : <><Check className="h-4 w-4" />Rename</>}
                    </Button>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </div>
    );
}

// ─── New Folder Modal ─────────────────────────────────────────────────────────

function NewFolderModal({ parentId, onClose }: { parentId: number | null; onClose: () => void }) {
    const [name, setName] = useState('Untitled folder');
    const [saving, setSaving] = useState(false);
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.select(); }, []);

    const submit = () => {
        if (!name.trim()) return;
        setSaving(true);
        router.post('/drive/folders', { name, parent_id: parentId }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: () => setSaving(false),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-xl">
                <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2"><FolderPlus className="h-4 w-4 text-primary" /></div>
                    <h3 className="font-semibold">New Folder</h3>
                </div>
                <Input ref={ref} value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
                    className="mb-4 text-sm" />
                <div className="flex gap-3">
                    <Button onClick={submit} disabled={!name.trim() || saving} className="gap-2">
                        {saving ? 'Creating…' : <><FolderPlus className="h-4 w-4" />Create</>}
                    </Button>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Move Modal ───────────────────────────────────────────────────────────────

function MoveModal({ item, allItems, onClose }: {
    item: DriveItem; allItems: DriveItem[]; onClose: () => void;
}) {
    const [targetId, setTargetId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    const folders = allItems.filter(i =>
        i.type === 'folder' && i.id !== item.id
    );

    const submit = () => {
        setSaving(true);
        router.patch(`/drive/items/${item.id}/move`, { parent_id: targetId }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); onClose(); },
            onError: () => setSaving(false),
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2"><Move className="h-4 w-4 text-primary" /></div>
                        <h3 className="font-semibold">Move "{item.name}"</h3>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="mb-4 max-h-48 overflow-y-auto rounded-lg border border-sidebar-border/50 bg-muted/20">
                    {/* Root option */}
                    <button
                        onClick={() => setTargetId(null)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-accent/50 ${
                            targetId === null ? 'bg-primary/10 font-medium text-primary' : ''
                        }`}
                    >
                        <Home className="h-4 w-4" />
                        My Drive (root)
                    </button>
                    {folders.map(f => (
                        <button key={f.id}
                            onClick={() => setTargetId(f.id)}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-accent/50 ${
                                targetId === f.id ? 'bg-primary/10 font-medium text-primary' : ''
                            }`}
                        >
                            <Folder className="h-4 w-4 text-yellow-400" />
                            {f.name}
                        </button>
                    ))}
                    {folders.length === 0 && (
                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">No other folders</p>
                    )}
                </div>

                <div className="flex gap-3">
                    <Button onClick={submit} disabled={saving} className="gap-2">
                        {saving ? 'Moving…' : <><Move className="h-4 w-4" />Move Here</>}
                    </Button>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuState { x: number; y: number; item: DriveItem }

function ContextMenu({ state, allItems, view, onClose, onRename, onMove }: {
    state: ContextMenuState;
    allItems: DriveItem[];
    view: ViewMode;
    onClose: () => void;
    onRename: (item: DriveItem) => void;
    onMove: (item: DriveItem) => void;
}) {
    const { item } = state;
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const action = (fn: () => void) => { fn(); onClose(); };

    if (view === 'trash') return (
        <div ref={ref} className="fixed z-50 min-w-[160px] rounded-lg border border-sidebar-border/70 bg-card py-1 shadow-xl"
            style={{ top: state.y, left: state.x }}>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50"
                onClick={() => action(() => router.post(`/drive/items/${item.id}/restore`, {}, { preserveScroll: true }))}>
                <RotateCcw className="h-3.5 w-3.5 text-green-600" />Restore
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                onClick={() => action(() => router.delete(`/drive/items/${item.id}/force`, { preserveScroll: true }))}>
                <Trash2 className="h-3.5 w-3.5" />Delete Forever
            </button>
        </div>
    );

    return (
        <div ref={ref} className="fixed z-50 min-w-[180px] rounded-lg border border-sidebar-border/70 bg-card py-1 shadow-xl"
            style={{ top: state.y, left: state.x }}>
            {item.type === 'folder' && (
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50"
                    onClick={() => action(() => router.get(`/drive/folder/${item.id}`))}>
                    <FolderOpen className="h-3.5 w-3.5 text-yellow-400" />Open
                </button>
            )}
            {item.type === 'file' && (
                <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50"
                    onClick={() => action(() => window.open(`/drive/items/${item.id}/download`, '_blank'))}>
                    <Download className="h-3.5 w-3.5 text-primary" />Download
                </button>
            )}
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50"
                onClick={() => action(() => onRename(item))}>
                <Pencil className="h-3.5 w-3.5" />Rename
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50"
                onClick={() => action(() => onMove(item))}>
                <Move className="h-3.5 w-3.5" />Move to…
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50"
                onClick={() => action(() => router.patch(`/drive/items/${item.id}/star`, {}, { preserveScroll: true }))}>
                <Star className={`h-3.5 w-3.5 ${item.is_starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                {item.is_starred ? 'Unstar' : 'Star'}
            </button>
            <div className="my-1 border-t border-sidebar-border/50" />
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                onClick={() => action(() => router.delete(`/drive/items/${item.id}`, { preserveScroll: true }))}>
                <Trash2 className="h-3.5 w-3.5" />Move to Trash
            </button>
        </div>
    );
}

// ─── Grid Item ────────────────────────────────────────────────────────────────

function GridItem({ item, view, onContextMenu, onDragStart, onDrop }: {
    item: DriveItem; view: ViewMode;
    onContextMenu: (e: React.MouseEvent, item: DriveItem) => void;
    onDragStart: (e: DragEvent, item: DriveItem) => void;
    onDrop: (e: DragEvent, targetId: number | null) => void;
}) {
    const [dragOver, setDragOver] = useState(false);
    const isFolder = item.type === 'folder';

    const handleClick = () => {
        if (view === 'trash') return;
        if (isFolder) router.get(`/drive/folder/${item.id}`);
    };

    return (
        <div
            draggable={view !== 'trash'}
            onDragStart={e => onDragStart(e, item)}
            onDragOver={e => { if (isFolder) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { setDragOver(false); if (isFolder) onDrop(e, item.id); }}
            onContextMenu={e => { e.preventDefault(); onContextMenu(e, item); }}
            onClick={handleClick}
            className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 transition select-none
                ${dragOver ? 'border-primary bg-primary/10' : 'border-sidebar-border/50 bg-muted/20 hover:bg-muted/40'}
                ${view === 'trash' ? 'opacity-70' : ''}`}
        >
            <div className="relative">
                <FileIcon item={item} size={10} />
                {item.is_starred && (
                    <Star className="absolute -top-1 -right-1 h-3 w-3 fill-yellow-400 text-yellow-400" />
                )}
            </div>
            <p className="w-full truncate text-center text-xs font-medium">{item.name}</p>
            {item.type === 'file' && (
                <p className="text-[10px] text-muted-foreground">{fmtSize(item.size)}</p>
            )}

            {/* Hover action — star shortcut */}
            {view !== 'trash' && (
                <button
                    className="absolute top-2 right-2 hidden rounded p-1 hover:bg-accent group-hover:flex"
                    onClick={e => { e.stopPropagation();
                        router.patch(`/drive/items/${item.id}/star`, {}, { preserveScroll: true }); }}
                >
                    <Star className={`h-3 w-3 ${item.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                </button>
            )}
        </div>
    );
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({ item, view, onContextMenu, onDragStart, onDrop }: {
    item: DriveItem; view: ViewMode;
    onContextMenu: (e: React.MouseEvent, item: DriveItem) => void;
    onDragStart: (e: DragEvent, item: DriveItem) => void;
    onDrop: (e: DragEvent, targetId: number | null) => void;
}) {
    const [dragOver, setDragOver] = useState(false);
    const isFolder = item.type === 'folder';

    return (
        <div
            draggable={view !== 'trash'}
            onDragStart={e => onDragStart(e, item)}
            onDragOver={e => { if (isFolder) { e.preventDefault(); setDragOver(true); } }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { setDragOver(false); if (isFolder) onDrop(e, item.id); }}
            onContextMenu={e => { e.preventDefault(); onContextMenu(e, item); }}
            onClick={() => { if (view !== 'trash' && isFolder) router.get(`/drive/folder/${item.id}`); }}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition select-none
                ${dragOver ? 'border-primary bg-primary/10' : 'border-sidebar-border/50 bg-muted/20 hover:bg-muted/40'}`}
        >
            <FileIcon item={item} size={5} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {item.type === 'file' && item.extension && (
                    <p className="text-xs uppercase text-muted-foreground">{item.extension}</p>
                )}
            </div>
            <div className="hidden items-center gap-6 text-xs text-muted-foreground sm:flex">
                <span className="w-16 text-right">{item.type === 'file' ? fmtSize(item.size) : '—'}</span>
                <span>{fmtDate(item.updated_at ?? item.created_at)}</span>
            </div>
            {item.is_starred && <Star className="h-3.5 w-3.5 flex-shrink-0 fill-yellow-400 text-yellow-400" />}
            <button
                onClick={e => { e.stopPropagation();
                    if (view === 'trash') {
                        router.post(`/drive/items/${item.id}/restore`, {}, { preserveScroll: true });
                    } else {
                        router.delete(`/drive/items/${item.id}`, { preserveScroll: true });
                    }
                }}
                className="flex-shrink-0 rounded p-1 opacity-0 hover:bg-destructive/10 group-hover:opacity-100 transition"
            >
                {view === 'trash'
                    ? <RotateCcw className="h-3.5 w-3.5 text-green-600" />
                    : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
            </button>
        </div>
    );
}

// ─── Drop Zone Overlay ────────────────────────────────────────────────────────

function DropZoneOverlay({ visible }: { visible: boolean }) {
    if (!visible) return null;
    return (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card/80 px-12 py-8 shadow-2xl">
                <Upload className="h-10 w-10 text-primary" />
                <p className="text-lg font-semibold">Drop files to upload</p>
                <p className="text-sm text-muted-foreground">Files will be added to the current folder</p>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DriveIndex() {
    const { folder, items, breadcrumbs: crumbs, usage, view: viewProp } = usePage<PageProps>().props;

    const view: ViewMode = viewProp ?? 'my-drive';
    const currentFolderId = folder?.id ?? null;

    const [displayMode, setDisplayMode]     = useState<DisplayMode>('grid');
    const [search, setSearch]               = useState('');
    const [renameTarget, setRenameTarget]   = useState<DriveItem | null>(null);
    const [newFolder, setNewFolder]         = useState(false);
    const [moveTarget, setMoveTarget]       = useState<DriveItem | null>(null);
    const [contextMenu, setContextMenu]     = useState<ContextMenuState | null>(null);
    const [globalDragOver, setGlobalDragOver] = useState(false);
    const [draggedItem, setDraggedItem]     = useState<DriveItem | null>(null);
    const fileInputRef                      = useRef<HTMLInputElement>(null);
    const dragCounter                       = useRef(0);

    // ── Search filter ──────────────────────────────────────────────────────
    const filtered = items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase())
    );
    const folders = filtered.filter(i => i.type === 'folder');
    const files   = filtered.filter(i => i.type === 'file');

    // ── Global drag-over for upload (not item drag) ────────────────────────
    const handleWindowDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
        if (view === 'trash' || view === 'starred') return;
        if (e.dataTransfer.types.includes('Files')) {
            dragCounter.current++;
            setGlobalDragOver(true);
        }
    }, [view]);

    const handleWindowDragLeave = useCallback(() => {
        dragCounter.current--;
        if (dragCounter.current <= 0) { dragCounter.current = 0; setGlobalDragOver(false); }
    }, []);

    const handleWindowDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounter.current = 0;
        setGlobalDragOver(false);

        // Only handle external file drops (not item reordering)
        if (!draggedItem && e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files, currentFolderId);
        }
    }, [draggedItem, currentFolderId]);

    // ── Item drag (move) ───────────────────────────────────────────────────
    const handleItemDragStart = (e: DragEvent, item: DriveItem) => {
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDropOnFolder = (e: DragEvent, targetFolderId: number | null) => {
        e.preventDefault();
        if (!draggedItem) return;
        if (draggedItem.id === targetFolderId) { setDraggedItem(null); return; }

        router.patch(`/drive/items/${draggedItem.id}/move`, { parent_id: targetFolderId }, {
            preserveScroll: true,
            onFinish: () => setDraggedItem(null),
        });
    };

    // ── File upload ────────────────────────────────────────────────────────
    const uploadFiles = (fileList: FileList, parentId: number | null) => {
        const formData = new FormData();
        Array.from(fileList).forEach(f => formData.append('files[]', f));
        if (parentId) formData.append('parent_id', String(parentId));

        router.post('/drive/upload', formData, {
            preserveScroll: true,
            forceFormData: true,
        });
    };

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            uploadFiles(e.target.files, currentFolderId);
            e.target.value = '';
        }
    };

    // ── Breadcrumb ─────────────────────────────────────────────────────────
    const appBreadcrumbs: BreadcrumbItem[] = [
        { title: 'Drive', href: '/drive' },
        ...crumbs.map(c => ({ title: c.name, href: `/drive/folder/${c.id}` })),
        ...(folder ? [{ title: folder.name, href: `/drive/folder/${folder.id}` }] : []),
    ];

    // ── Sidebar nav items ──────────────────────────────────────────────────
    const MAX_STORAGE = 15 * 1024 ** 3; // 15 GB display cap
    const usagePct = Math.min((usage / MAX_STORAGE) * 100, 100);

    return (
        <AppLayout breadcrumbs={appBreadcrumbs}>
            <Head title="Drive" />

            {/* Modals */}
            {renameTarget && <RenameModal item={renameTarget} onClose={() => setRenameTarget(null)} />}
            {newFolder    && <NewFolderModal parentId={currentFolderId} onClose={() => setNewFolder(false)} />}
            {moveTarget   && <MoveModal item={moveTarget} allItems={items} onClose={() => setMoveTarget(null)} />}
            {contextMenu  && (
                <ContextMenu
                    state={contextMenu}
                    allItems={items}
                    view={view}
                    onClose={() => setContextMenu(null)}
                    onRename={i => { setContextMenu(null); setRenameTarget(i); }}
                    onMove={i => { setContextMenu(null); setMoveTarget(i); }}
                />
            )}

            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" multiple className="hidden"
                onChange={handleFileInputChange} />

            {/* Full-page drop zone */}
            <div className="flex h-full flex-1 flex-col"
                onDragEnter={handleWindowDragEnter}
                onDragLeave={handleWindowDragLeave}
                onDragOver={e => e.preventDefault()}
                onDrop={handleWindowDrop}>

                <DropZoneOverlay visible={globalDragOver && !draggedItem} />

                <div className="flex flex-1 gap-0 overflow-hidden">

                    {/* ── Sidebar ─────────────────────────────────────────── */}
                    <aside className="hidden w-56 flex-shrink-0 flex-col gap-1 border-r border-sidebar-border/50 bg-card p-4 lg:flex">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="mb-3 flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:opacity-90 transition"
                        >
                            <Upload className="h-4 w-4" />
                            Upload
                        </button>

                        {[
                            { label: 'My Drive', icon: HardDrive, href: '/drive', active: view === 'my-drive' },
                            { label: 'Starred', icon: Star, href: '/drive/starred', active: view === 'starred' },
                            { label: 'Trash', icon: Trash2, href: '/drive/trash', active: view === 'trash' },
                        ].map(nav => (
                            <button key={nav.label}
                                onClick={() => router.get(nav.href)}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition
                                    ${nav.active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent/50'}`}
                            >
                                <nav.icon className="h-4 w-4" />
                                {nav.label}
                            </button>
                        ))}

                        {/* Storage usage */}
                        <div className="mt-auto rounded-xl border border-sidebar-border/50 bg-muted/30 p-3">
                            <p className="mb-1.5 text-xs font-medium">Storage</p>
                            <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${usagePct}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {fmtUsage(usage)} used
                            </p>
                        </div>
                    </aside>

                    {/* ── Main area ────────────────────────────────────────── */}
                    <main className="flex flex-1 flex-col overflow-auto p-6">

                        {/* Top bar */}
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            {/* Breadcrumb */}
                            <div className="flex min-w-0 items-center gap-1 text-sm">
                                <button onClick={() => router.get('/drive')}
                                    className="flex items-center gap-1 rounded px-1 py-0.5 text-muted-foreground hover:text-foreground">
                                    <Home className="h-4 w-4" />
                                    <span className="hidden sm:inline">My Drive</span>
                                </button>
                                {crumbs.map(c => (
                                    <span key={c.id} className="flex items-center gap-1">
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        <button onClick={() => router.get(`/drive/folder/${c.id}`)}
                                            className="rounded px-1 py-0.5 text-muted-foreground hover:text-foreground">
                                            {c.name}
                                        </button>
                                    </span>
                                ))}
                                {folder && (
                                    <span className="flex items-center gap-1">
                                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="truncate font-medium">{folder.name}</span>
                                    </span>
                                )}
                                {view === 'starred' && <span className="font-medium">Starred</span>}
                                {view === 'trash' && <span className="font-medium">Trash</span>}
                            </div>

                            {/* Actions row */}
                            <div className="flex items-center gap-2">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder="Filter…" className="h-8 w-36 pl-7 text-xs sm:w-48" />
                                </div>

                                {/* Display mode toggle */}
                                <div className="flex overflow-hidden rounded-lg border border-sidebar-border/50">
                                    <button onClick={() => setDisplayMode('grid')}
                                        className={`p-2 transition ${displayMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`}>
                                        <Grid3x3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => setDisplayMode('list')}
                                        className={`p-2 transition ${displayMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent/50'}`}>
                                        <List className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                {/* Folder + Upload (not in trash/starred) */}
                                {view === 'my-drive' && (
                                    <>
                                        <Button size="sm" variant="outline" className="gap-1.5"
                                            onClick={() => setNewFolder(true)}>
                                            <FolderPlus className="h-4 w-4" />
                                            <span className="hidden sm:inline">New Folder</span>
                                        </Button>
                                        <Button size="sm" className="gap-1.5"
                                            onClick={() => fileInputRef.current?.click()}>
                                            <Upload className="h-4 w-4" />
                                            <span className="hidden sm:inline">Upload</span>
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Drop zone hint (when empty) */}
                        {view === 'my-drive' && items.length === 0 && (
                            <div
                                className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-sidebar-border/50 text-center"
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => {
                                    e.preventDefault();
                                    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files, currentFolderId);
                                }}
                            >
                                <Upload className="h-12 w-12 text-muted-foreground/40" />
                                <div>
                                    <p className="font-medium">Drop files here or click Upload</p>
                                    <p className="text-sm text-muted-foreground">Supports any file type up to 100 MB</p>
                                </div>
                                <Button size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                                    <Upload className="h-4 w-4" />Upload Files
                                </Button>
                            </div>
                        )}

                        {/* Folders section */}
                        {folders.length > 0 && (
                            <div className="mb-6">
                                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Folders
                                </p>
                                {displayMode === 'grid' ? (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                        {folders.map(item => (
                                            <GridItem key={item.id} item={item} view={view}
                                                onContextMenu={(e, i) => setContextMenu({ x: e.clientX, y: e.clientY, item: i })}
                                                onDragStart={handleItemDragStart}
                                                onDrop={handleDropOnFolder}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {folders.map(item => (
                                            <ListRow key={item.id} item={item} view={view}
                                                onContextMenu={(e, i) => setContextMenu({ x: e.clientX, y: e.clientY, item: i })}
                                                onDragStart={handleItemDragStart}
                                                onDrop={handleDropOnFolder}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Files section */}
                        {files.length > 0 && (
                            <div>
                                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {view === 'trash' ? 'Deleted Files' : 'Files'}
                                </p>
                                {displayMode === 'grid' ? (
                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                        {files.map(item => (
                                            <GridItem key={item.id} item={item} view={view}
                                                onContextMenu={(e, i) => setContextMenu({ x: e.clientX, y: e.clientY, item: i })}
                                                onDragStart={handleItemDragStart}
                                                onDrop={handleDropOnFolder}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        {/* List header */}
                                        <div className="mb-1 hidden grid-cols-[1fr_5rem_8rem_2.5rem] gap-3 px-4 text-xs font-medium text-muted-foreground sm:grid">
                                            <span>Name</span><span className="text-right">Size</span>
                                            <span>Modified</span><span />
                                        </div>
                                        <div className="space-y-1.5">
                                            {files.map(item => (
                                                <ListRow key={item.id} item={item} view={view}
                                                    onContextMenu={(e, i) => setContextMenu({ x: e.clientX, y: e.clientY, item: i })}
                                                    onDragStart={handleItemDragStart}
                                                    onDrop={handleDropOnFolder}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Trash empty state */}
                        {view === 'trash' && items.length === 0 && (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                                <Trash2 className="h-12 w-12 text-muted-foreground/30" />
                                <p className="font-medium">Trash is empty</p>
                                <p className="text-sm text-muted-foreground">Deleted items will appear here</p>
                            </div>
                        )}

                        {/* Starred empty state */}
                        {view === 'starred' && items.length === 0 && (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                                <Star className="h-12 w-12 text-muted-foreground/30" />
                                <p className="font-medium">No starred items</p>
                                <p className="text-sm text-muted-foreground">Right-click any file or folder to star it</p>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </AppLayout>
    );
}
