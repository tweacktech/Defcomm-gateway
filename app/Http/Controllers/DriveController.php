<?php

namespace App\Http\Controllers;

use App\Models\DriveItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class DriveController extends Controller
{
    // ── Pages ─────────────────────────────────────────────────────────────────

    /**
     * Render the drive root or a specific folder.
     * GET /drive
     * GET /drive/folder/{folder}
     */
    public function index(Request $request, ?DriveItem $folder = null): Response
    {
        $userId = $request->user()->id;

        // Validate folder ownership when navigating into one
        if ($folder && $folder->exists) {
            $this->authorizeOwner($request, $folder);
        } else {
            $folder = null;
        }

        $parentId = $folder?->id;

        $items = DriveItem::query()
            ->forUser($userId)
            ->where('parent_id', $parentId)
            ->orderByRaw("type = 'file'")   // folders first
            ->orderBy('name')
            ->get([
                'id', 'parent_id', 'type', 'name', 'mime_type',
                'size', 'extension', 'is_starred', 'created_at', 'updated_at',
            ]);

        // Storage usage summary
        $usage = DriveItem::forUser($userId)
            ->files()
            ->sum('size');

        return Inertia::render('settings/drive', [
            'folder'    => $folder ? $this->folderResource($folder) : null,
            'items'     => $items,
            'breadcrumbs' => $folder ? $folder->breadcrumbs() : [],
            'usage'     => $usage,
        ]);
    }

    /** Starred files/folders */
    public function starred(Request $request): Response
    {
        $userId = $request->user()->id;

        $items = DriveItem::query()
            ->forUser($userId)
            ->starred()
            ->orderByRaw("type = 'file'")
            ->orderBy('name')
            ->get(['id', 'parent_id', 'type', 'name', 'mime_type',
                   'size', 'extension', 'is_starred', 'created_at', 'updated_at']);

        return Inertia::render('settings/drive', [
            'folder'      => null,
            'items'       => $items,
            'breadcrumbs' => [],
            'usage'       => DriveItem::forUser($userId)->files()->sum('size'),
            'view'        => 'starred',
        ]);
    }

    /** Soft-deleted items (trash) */
    public function trash(Request $request): Response
    {
        $userId = $request->user()->id;

        $items = DriveItem::onlyTrashed()
            ->forUser($userId)
            ->orderBy('deleted_at', 'desc')
            ->get(['id', 'parent_id', 'type', 'name', 'mime_type',
                   'size', 'extension', 'is_starred', 'deleted_at']);

        return Inertia::render('settings/drive', [
            'folder'      => null,
            'items'       => $items,
            'breadcrumbs' => [],
            'usage'       => DriveItem::forUser($userId)->files()->sum('size'),
            'view'        => 'trash',
        ]);
    }

    // ── Folder CRUD ───────────────────────────────────────────────────────────

    /** POST /drive/folders */
    public function createFolder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:drive_items,id'],
        ]);

        if ($validated['parent_id'] ?? null) {
            $parent = DriveItem::findOrFail($validated['parent_id']);
            $this->authorizeOwner($request, $parent);
        }

        DriveItem::create([
            'user_id'   => $request->user()->id,
            'parent_id' => $validated['parent_id'] ?? null,
            'type'      => 'folder',
            'name'      => $validated['name'],
        ]);

        return redirect()->back()->with('success', 'Folder created.');
    }

    // ── File Upload ───────────────────────────────────────────────────────────

    /**
     * POST /drive/upload
     * Accepts one or many files in `files[]`.
     */
    public function upload(Request $request): RedirectResponse
    {
        $request->validate([
            'files'     => ['required', 'array', 'min:1'],
            'files.*'   => ['required', 'file', 'max:102400'], // 100 MB each
            'parent_id' => ['nullable', 'integer', 'exists:drive_items,id'],
        ]);

        $userId   = $request->user()->id;
        $parentId = $request->input('parent_id');

        if ($parentId) {
            $parent = DriveItem::findOrFail($parentId);
            $this->authorizeOwner($request, $parent);
        }

        foreach ($request->file('files') as $file) {
            $ext      = $file->getClientOriginalExtension();
            $stored   = $file->store("drive/{$userId}", 'local');

            DriveItem::create([
                'user_id'       => $userId,
                'parent_id'     => $parentId,
                'type'          => 'file',
                'name'          => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
                'original_name' => $file->getClientOriginalName(),
                'mime_type'     => $file->getMimeType(),
                'extension'     => $ext ?: null,
                'size'          => $file->getSize(),
                'disk'          => 'local',
                'path'          => $stored,
            ]);
        }

        $count = count($request->file('files'));
        return redirect()->back()->with('success', "{$count} file(s) uploaded.");
    }

    // ── Item Actions ──────────────────────────────────────────────────────────

    /** PATCH /drive/items/{item}/rename */
    public function rename(Request $request, DriveItem $item): RedirectResponse
    {
        $this->authorizeOwner($request, $item);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $item->update(['name' => $validated['name']]);

        return redirect()->back()->with('success', 'Renamed.');
    }

    /** PATCH /drive/items/{item}/move */
    public function move(Request $request, DriveItem $item): RedirectResponse
    {
        $this->authorizeOwner($request, $item);

        $validated = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:drive_items,id'],
        ]);

        $newParentId = $validated['parent_id'] ?? null;

        // Prevent moving a folder into itself or its own descendants
        if ($item->isFolder() && $newParentId) {
            $target = DriveItem::findOrFail($newParentId);
            $this->authorizeOwner($request, $target);

            if ($this->isDescendant($item, $newParentId)) {
                return redirect()->back()->withErrors(['parent_id' => 'Cannot move a folder into itself.']);
            }
        }

        $item->update(['parent_id' => $newParentId]);

        return redirect()->back()->with('success', 'Moved.');
    }

    /** PATCH /drive/items/{item}/star */
    public function star(Request $request, DriveItem $item): RedirectResponse
    {
        $this->authorizeOwner($request, $item);
        $item->update(['is_starred' => !$item->is_starred]);

        return redirect()->back()->with('success', $item->is_starred ? 'Starred.' : 'Unstarred.');
    }

    /** DELETE /drive/items/{item}  → soft delete (trash) */
    public function destroy(Request $request, DriveItem $item): RedirectResponse
    {
        $this->authorizeOwner($request, $item);
        $item->delete();                              // soft delete

        return redirect()->back()->with('success', 'Moved to trash.');
    }

    /** POST /drive/items/{item}/restore */
    public function restore(Request $request, int $id): RedirectResponse
    {
        $item = DriveItem::onlyTrashed()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $item->restore();

        return redirect()->back()->with('success', 'Restored.');
    }

    /** DELETE /drive/items/{item}/force */
    public function forceDelete(Request $request, int $id): RedirectResponse
    {
        $item = DriveItem::onlyTrashed()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        if ($item->isFile() && $item->path) {
            Storage::disk($item->disk)->delete($item->path);
        }

        $item->forceDelete();

        return redirect()->back()->with('success', 'Permanently deleted.');
    }

    /** GET /drive/items/{item}/download */
    public function download(Request $request, DriveItem $item)
    {
        $this->authorizeOwner($request, $item);

        if ($item->isFolder() || !$item->path) {
            abort(400, 'Cannot download a folder.');
        }

        return Storage::disk($item->disk)->download(
            $item->path,
            $item->original_name ?? $item->name,
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function authorizeOwner(Request $request, DriveItem $item): void
    {
        if ((int) $item->user_id !== (int) $request->user()->id) {
            abort(403);
        }
    }

    private function isDescendant(DriveItem $ancestor, int $targetId): bool
    {
        if ((int) $ancestor->id === $targetId) return true;

        foreach ($ancestor->children as $child) {
            if ($child->isFolder() && $this->isDescendant($child, $targetId)) {
                return true;
            }
        }

        return false;
    }

    private function folderResource(DriveItem $folder): array
    {
        return [
            'id'        => $folder->id,
            'name'      => $folder->name,
            'parent_id' => $folder->parent_id,
        ];
    }
}
