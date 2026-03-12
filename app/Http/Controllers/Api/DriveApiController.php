<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DriveItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * API Drive Controller
 *
 * Auth: Sanctum token  →  Authorization: Bearer <token>
 *
 * Response envelope:
 *   200/201  { data, message?, meta? }
 *   204      (empty – force delete)
 *   4xx      { message, errors? }
 */
class DriveApiController extends Controller
{
    // ── Listing ───────────────────────────────────────────────────────────────

    /**
     * List items in a folder (or root when parent_id is absent).
     *
     * GET /api/drive
     * GET /api/drive?parent_id=42
     * GET /api/drive?type=folder
     * GET /api/drive?search=report
     * GET /api/drive?sort=name&direction=asc
     * GET /api/drive?per_page=20&page=2
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:drive_items,id'],
            'type'      => ['nullable', 'in:folder,file'],
            'search'    => ['nullable', 'string', 'max:255'],
            'sort'      => ['nullable', 'in:name,size,created_at,updated_at'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page'  => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $userId   = $request->user()->id;
        $parentId = $request->input('parent_id');

        if ($parentId) {
            $parent = DriveItem::forUser($userId)->findOrFail($parentId);
        }

        $query = DriveItem::query()
            ->forUser($userId)
            ->where('parent_id', $parentId)
            ->orderByRaw("CASE WHEN type = 'folder' THEN 0 ELSE 1 END")
            ->orderBy(
                $request->input('sort', 'name'),
                $request->input('direction', 'asc')
            );

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->input('search') . '%');
        }

        $paginated = $query->paginate(
            $request->integer('per_page', 50),
            ['id', 'parent_id', 'type', 'name', 'mime_type', 'size',
             'extension', 'original_name', 'is_starred', 'created_at', 'updated_at']
        )->withQueryString();

        return response()->json([
            'data'   => array_map(fn($i) => $this->itemResource($i), $paginated->items()),
            'folder' => isset($parent) ? $this->folderContext($parent) : null,
            'meta'   => $this->paginatorMeta($paginated),
            'usage'  => DriveItem::forUser($userId)->files()->sum('size'),
        ]);
    }

    /**
     * Get a single item's metadata.
     *
     * GET /api/drive/items/{item}
     */
    public function show(Request $request, DriveItem $item): JsonResponse
    {
        $this->authorizeOwner($request, $item);

        return response()->json([
            'data' => $this->itemResource($item, withBreadcrumbs: true),
        ]);
    }

    /**
     * List all starred items.
     *
     * GET /api/drive/starred
     */
    public function starred(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $items = DriveItem::query()
            ->forUser($userId)
            ->starred()
            ->orderByRaw("CASE WHEN type = 'folder' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->get(['id', 'parent_id', 'type', 'name', 'mime_type',
                   'size', 'extension', 'is_starred', 'created_at', 'updated_at']);

        return response()->json([
            'data' => array_map(fn($i) => $this->itemResource($i), $items->all()),
        ]);
    }

    /**
     * List trashed items (paginated).
     *
     * GET /api/drive/trash
     */
    public function trash(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $paginated = DriveItem::onlyTrashed()
            ->forUser($userId)
            ->orderBy('deleted_at', 'desc')
            ->paginate(
                $request->integer('per_page', 50),
                ['id', 'parent_id', 'type', 'name', 'mime_type',
                 'size', 'extension', 'is_starred', 'deleted_at']
            )
            ->withQueryString();

        return response()->json([
            'data' => array_map(fn($i) => $this->itemResource($i), $paginated->items()),
            'meta' => $this->paginatorMeta($paginated),
        ]);
    }

    /**
     * Full-drive search (not limited to a folder).
     *
     * GET /api/drive/search?q=report
     * GET /api/drive/search?q=report&type=file
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q'        => ['required', 'string', 'min:1', 'max:255'],
            'type'     => ['nullable', 'in:folder,file'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $userId = $request->user()->id;

        $query = DriveItem::query()
            ->forUser($userId)
            ->where('name', 'like', '%' . $request->input('q') . '%')
            ->orderByRaw("CASE WHEN type = 'folder' THEN 0 ELSE 1 END")
            ->orderBy('name');

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $paginated = $query->paginate(
            $request->integer('per_page', 50),
            ['id', 'parent_id', 'type', 'name', 'mime_type',
             'size', 'extension', 'is_starred', 'created_at', 'updated_at']
        );

        return response()->json([
            'data'  => array_map(fn($i) => $this->itemResource($i), $paginated->items()),
            'meta'  => array_merge($this->paginatorMeta($paginated), [
                'query' => $request->input('q'),
            ]),
        ]);
    }

    /**
     * Storage usage summary for the authenticated user.
     *
     * GET /api/drive/usage
     */
    public function usage(Request $request): JsonResponse
    {
        $used = DriveItem::forUser($request->user()->id)->files()->sum('size');

        return response()->json([
            'data' => [
                'used_bytes' => $used,
                'used_human' => $this->formatBytes($used),
                'limit_bytes' => null,   // wire up your plan limits here
            ],
        ]);
    }

    // ── Folder ────────────────────────────────────────────────────────────────

    /**
     * Create a folder.
     *
     * POST /api/drive/folders
     * { "name": "Reports", "parent_id": 42 }
     */
    public function createFolder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:drive_items,id'],
        ]);

        if ($validated['parent_id'] ?? null) {
            $parent = DriveItem::findOrFail($validated['parent_id']);
            $this->authorizeOwner($request, $parent);
        }

        $folder = DriveItem::create([
            'user_id'   => $request->user()->id,
            'parent_id' => $validated['parent_id'] ?? null,
            'type'      => 'folder',
            'name'      => $validated['name'],
        ]);

        return response()->json([
            'data'    => $this->itemResource($folder),
            'message' => 'Folder created.',
        ], 201);
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    /**
     * Upload one or many files.
     *
     * POST /api/drive/upload  (multipart/form-data)
     * files[]   — binary file(s), max 100 MB each
     * parent_id — optional target folder ID
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'files'     => ['required', 'array', 'min:1'],
            'files.*'   => ['required', 'file', 'max:102400'],
            'parent_id' => ['nullable', 'integer', 'exists:drive_items,id'],
        ]);

        $userId   = $request->user()->id;
        $parentId = $request->input('parent_id');

        if ($parentId) {
            $parent = DriveItem::findOrFail($parentId);
            $this->authorizeOwner($request, $parent);
        }

        $created = [];

        foreach ($request->file('files') as $file) {
            $ext    = $file->getClientOriginalExtension();
            $stored = $file->store("drive/{$userId}", 'local');

            $created[] = DriveItem::create([
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

        return response()->json([
            'data'    => array_map(fn($i) => $this->itemResource($i), $created),
            'message' => count($created) . ' file(s) uploaded.',
        ], 201);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * Rename an item.
     *
     * PATCH /api/drive/items/{item}/rename
     * { "name": "New Name" }
     */
    public function rename(Request $request, DriveItem $item): JsonResponse
    {
        $this->authorizeOwner($request, $item);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $item->update(['name' => $validated['name']]);

        return response()->json([
            'data'    => $this->itemResource($item->fresh()),
            'message' => 'Renamed.',
        ]);
    }

    /**
     * Move an item into a different folder (or back to root).
     *
     * PATCH /api/drive/items/{item}/move
     * { "parent_id": 99 }   or   { "parent_id": null }
     */
    public function move(Request $request, DriveItem $item): JsonResponse
    {
        $this->authorizeOwner($request, $item);

        $validated = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:drive_items,id'],
        ]);

        $newParentId = $validated['parent_id'] ?? null;

        if ($item->isFolder() && $newParentId) {
            $target = DriveItem::findOrFail($newParentId);
            $this->authorizeOwner($request, $target);

            if ($this->isDescendant($item, $newParentId)) {
                return response()->json([
                    'message' => 'Cannot move a folder into itself or its descendants.',
                    'errors'  => ['parent_id' => ['Circular move detected.']],
                ], 422);
            }
        }

        $item->update(['parent_id' => $newParentId]);

        return response()->json([
            'data'    => $this->itemResource($item->fresh()),
            'message' => 'Moved.',
        ]);
    }

    /**
     * Toggle the starred flag on an item.
     *
     * PATCH /api/drive/items/{item}/star
     */
    public function star(Request $request, DriveItem $item): JsonResponse
    {
        $this->authorizeOwner($request, $item);
        $item->update(['is_starred' => !$item->is_starred]);

        return response()->json([
            'data'    => $this->itemResource($item->fresh()),
            'message' => $item->is_starred ? 'Starred.' : 'Unstarred.',
        ]);
    }

    /**
     * Soft-delete (move to trash).
     *
     * DELETE /api/drive/items/{item}
     */
    public function destroy(Request $request, DriveItem $item): JsonResponse
    {
        $this->authorizeOwner($request, $item);
        $item->delete();

        return response()->json(['message' => 'Moved to trash.']);
    }

    /**
     * Restore a trashed item.
     *
     * POST /api/drive/items/{id}/restore
     */
    public function restore(Request $request, int $id): JsonResponse
    {
        $item = DriveItem::onlyTrashed()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $item->restore();

        return response()->json([
            'data'    => $this->itemResource($item),
            'message' => 'Restored.',
        ]);
    }

    /**
     * Permanently delete and wipe from disk.
     *
     * DELETE /api/drive/items/{id}/force
     * Returns 204 No Content on success.
     */
    public function forceDelete(Request $request, int $id): JsonResponse
    {
        $item = DriveItem::onlyTrashed()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        if ($item->isFile() && $item->path) {
            Storage::disk($item->disk)->delete($item->path);
        }

        $item->forceDelete();

        return response()->json(null, 204);
    }

    /**
     * Stream / download a file.
     *
     * GET /api/drive/items/{item}/download
     */
    public function download(Request $request, DriveItem $item)
    {
        $this->authorizeOwner($request, $item);

        if ($item->isFolder() || !$item->path) {
            return response()->json(['message' => 'Cannot download a folder.'], 400);
        }

        return Storage::disk($item->disk)->download(
            $item->path,
            $item->original_name ?? $item->name,
        );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function authorizeOwner(Request $request, DriveItem $item): void
    {
        if ((int) $item->user_id !== (int) $request->user()->id) {
            abort(403, 'Forbidden.');
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

    /** Canonical item shape returned in every response. */
    private function itemResource(DriveItem $item, bool $withBreadcrumbs = false): array
    {
        $resource = [
            'id'            => $item->id,
            'parent_id'     => $item->parent_id,
            'type'          => $item->type,
            'name'          => $item->name,
            'original_name' => $item->original_name,
            'mime_type'     => $item->mime_type,
            'extension'     => $item->extension,
            'size'          => $item->size,
            'size_human'    => $item->formattedSize(),
            'is_starred'    => $item->is_starred,
            'created_at'    => $item->created_at?->toIso8601String(),
            'updated_at'    => $item->updated_at?->toIso8601String(),
            'deleted_at'    => $item->deleted_at?->toIso8601String(),
            'download_url'  => $item->isFile()
                                ? url("/api/drive/items/{$item->id}/download")
                                : null,
        ];

        if ($withBreadcrumbs) {
            $resource['breadcrumbs'] = $item->breadcrumbs();
        }

        return $resource;
    }

    private function folderContext(DriveItem $folder): array
    {
        return [
            'id'          => $folder->id,
            'name'        => $folder->name,
            'parent_id'   => $folder->parent_id,
            'breadcrumbs' => $folder->breadcrumbs(),
        ];
    }

    private function paginatorMeta($paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
            'per_page'     => $paginator->perPage(),
            'total'        => $paginator->total(),
            'from'         => $paginator->firstItem(),
            'to'           => $paginator->lastItem(),
        ];
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes === 0) return '0 B';
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = min((int) floor(log($bytes, 1024)), count($units) - 1);
        return round($bytes / (1024 ** $i), 2) . ' ' . $units[$i];
    }
}
