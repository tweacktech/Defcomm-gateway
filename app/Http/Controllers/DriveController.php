<?php

namespace App\Http\Controllers;

use App\Models\DriveItem;
use App\Models\DriveShare;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class DriveController extends Controller
{
    // =========================================================================
    // PAGES
    // =========================================================================

    /**
     * Render the drive root or a specific folder.
     *
     * GET /drive
     * GET /drive/folder/{folder}
     */
    public function index(Request $request, ?DriveItem $folder = null): Response
    {
        $userId = $request->user()->id;

        if ($folder && $folder->exists) {
            $this->authorizeOwner($request, $folder);
        } else {
            $folder = null;
        }

        $parentId = $folder?->id;

        $items = DriveItem::query()
            ->forUser($userId)
            ->where('parent_id', $parentId)
            ->orderByRaw("CASE WHEN type = 'folder' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->get([
                'id', 'parent_id', 'type', 'name', 'mime_type', 'size',
                'extension', 'is_starred', 'visibility', 'created_at', 'updated_at',
            ]);

        return Inertia::render('settings/drive', [
            'folder' => $folder ? $this->folderResource($folder) : null,
            'items' => $items,
            'breadcrumbs' => $folder ? $folder->breadcrumbs() : [],
            'usage' => $this->storageUsage($userId),
            'storage_limit' => $this->storageLimit($request->user()),
        ]);
    }

    /**
     * GET /drive/starred.
     */
    public function starred(Request $request): Response
    {
        $userId = $request->user()->id;

        $items = DriveItem::query()
            ->forUser($userId)
            ->starred()
            ->orderByRaw("CASE WHEN type = 'folder' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->get([
                'id', 'parent_id', 'type', 'name', 'mime_type', 'size',
                'extension', 'is_starred', 'visibility', 'created_at', 'updated_at',
            ]);

        return Inertia::render('settings/drive', [
            'folder' => null,
            'items' => $items,
            'breadcrumbs' => [],
            'usage' => $this->storageUsage($userId),
            'storage_limit' => $this->storageLimit($request->user()),
            'view' => 'starred',
        ]);
    }

    /**
     * GET /drive/trash.
     */
    public function trash(Request $request): Response
    {
        $userId = $request->user()->id;

        $items = DriveItem::onlyTrashed()
            ->forUser($userId)
            ->orderBy('deleted_at', 'desc')
            ->get([
                'id', 'parent_id', 'type', 'name', 'mime_type', 'size',
                'extension', 'is_starred', 'visibility', 'deleted_at',
            ]);

        return Inertia::render('settings/drive', [
            'folder' => null,
            'items' => $items,
            'breadcrumbs' => [],
            'usage' => $this->storageUsage($userId),
            'storage_limit' => $this->storageLimit($request->user()),
            'view' => 'trash',
        ])->with('success', 'This is your trash. Items here are not deleted yet and still count against your storage quota. You can restore or permanently delete them.');
    }

    // =========================================================================
    // FOLDER CRUD
    // =========================================================================

    /**
     * POST /drive/folders.
     */
    public function createFolder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:drive_items,id'],
        ]);

        if ($validated['parent_id'] ?? null) {
            $parent = DriveItem::findOrFail($validated['parent_id']);
            $this->authorizeOwner($request, $parent);
        }

        DriveItem::create([
            'user_id' => $request->user()->id,
            'parent_id' => $validated['parent_id'] ?? null,
            'type' => 'folder',
            'name' => $validated['name'],
            'visibility' => 'private',
        ]);

        return redirect()->back()->with('success', 'Folder created.');
    }

    // =========================================================================
    // FILE UPLOAD
    // =========================================================================

    /**
     * POST /drive/upload.
     *
     * Accepts files[] (multipart) + optional parent_id.
     * Enforces per-user storage quota before writing anything to disk.
     */
    public function upload(Request $request): RedirectResponse
    {
        try {
            $request->validate([
                'files' => ['required', 'array', 'min:1'],
                'files.*' => ['required', 'file', 'max:102400'], // 100 MB each
                'parent_id' => ['nullable', 'integer', 'exists:drive_items,id'],
            ]);

            $userId = $request->user()->id;
            $parentId = $request->input('parent_id');

            if ($parentId) {
                $parent = DriveItem::findOrFail($parentId);
                $this->authorizeOwner($request, $parent);
            }

            // ── Quota check ───────────────────────────────────────────────────
            $limit = $this->storageLimit($request->user());
            $used = $this->storageUsage($userId);
            $incoming = collect($request->file('files'))->sum(fn ($f) => $f->getSize());

            if (($used + $incoming) > $limit) {
                $limitHuman = $this->formatBytes($limit);

                return redirect()->back()->withErrors([
                    'files' => "Upload would exceed your storage limit of {$limitHuman}.",
                ]);
            }
            // ─────────────────────────────────────────────────────────────────

            foreach ($request->file('files') as $file) {
                $ext = $file->getClientOriginalExtension();
                $stored = $file->store("drive/{$userId}", 'local');

                DriveItem::create([
                    'user_id' => $userId,
                    'parent_id' => $parentId,
                    'type' => 'file',
                    'name' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
                    'original_name' => $file->getClientOriginalName(),
                    'mime_type' => $file->getMimeType(),
                    'extension' => $ext ?: null,
                    'size' => $file->getSize(),
                    'disk' => 'local',
                    'path' => $stored,
                    'visibility' => 'private',
                ]);
            }

            $count = count($request->file('files'));

            return redirect()->back()->with('success', "{$count} file(s) uploaded.");
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    // =========================================================================
    // ITEM MUTATIONS
    // =========================================================================

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

        if ($item->isFolder() && $newParentId) {
            $target = DriveItem::findOrFail($newParentId);
            $this->authorizeOwner($request, $target);

            if ($this->isDescendant($item, $newParentId)) {
                return redirect()->back()->withErrors([
                    'parent_id' => 'Cannot move a folder into itself.',
                ]);
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

    /** DELETE /drive/items/{item} → soft delete */
    public function destroy(Request $request, DriveItem $item): RedirectResponse
    {
        $this->authorizeOwner($request, $item);
        $item->delete();

        return redirect()->back()->with('success', 'Moved to trash.');
    }

    /** POST /drive/items/{id}/restore */
    public function restore(Request $request, int $id): RedirectResponse
    {
        $item = DriveItem::onlyTrashed()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $item->restore();

        return redirect()->back()->with('success', 'Restored.');
    }

    /** DELETE /drive/items/{id}/force */
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

    // =========================================================================
    // VISIBILITY
    // =========================================================================

    /**
     * Toggle public / private visibility on any item the user owns.
     *
     * PATCH /drive/items/{item}/visibility
     * Body: { visibility: 'private'|'public' }
     *
     * Setting a folder public does NOT cascade to children — each item
     * controls its own visibility independently.
     */
    public function setVisibility(Request $request, DriveItem $item): RedirectResponse
    {
        $this->authorizeOwner($request, $item);

        $validated = $request->validate([
            'visibility' => ['required', 'in:private,public'],
        ]);

        $item->update(['visibility' => $validated['visibility']]);

        $label = $validated['visibility'] === 'public' ? 'Public' : 'Private';

        return redirect()->back()->with('success', "Visibility set to {$label}.");
    }

    // =========================================================================
    // SHARE LINKS
    // =========================================================================

    /**
     * Create a new share link for an item.
     *
     * POST /drive/items/{item}/shares
     * Body:
     *   permission      string  'view'|'download'   required
     *   password        string                       optional
     *   max_uses        int                          optional
     *   expires_in_days int     1–365                optional
     *
     * On success, the generated share URL is flashed as `share_url` so the
     * React page can read it from Inertia's flash props without a redirect.
     */
    public function createShareLink(Request $request, DriveItem $item): RedirectResponse
    {
        $this->authorizeOwner($request, $item);

        $validated = $request->validate([
            'permission' => ['required', 'in:view,download'],
            'password' => ['nullable', 'string', 'min:4', 'max:128'],
            'max_uses' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $expiresAt = isset($validated['expires_in_days'])
            ? now()->addDays((int) $validated['expires_in_days'])
            : null;

        $share = DriveShare::makeLink(
            item: $item,
            permission: $validated['permission'],
            password: $validated['password'] ?? null,
            maxUses: isset($validated['max_uses']) ? (int) $validated['max_uses'] : null,
            expiresAt: $expiresAt,
        );

        $share->save();

        $shareUrl = route('drive.share.access', $share->token);

        return redirect()->back()->with([
            'success' => 'Share link created.',
            'share_url' => $shareUrl,
        ]);
    }

    /**
     * List all active shares for an item (owner-only).
     *
     * GET /drive/items/{item}/shares
     */
    public function listShares(Request $request, DriveItem $item): Response
    {
        $this->authorizeOwner($request, $item);

        $shares = $item->shares()
            ->with('recipient:id,name,email')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn ($s) => $this->shareResource($s));

        return Inertia::render('drive/shares', [
            'item' => [
                'id' => $item->id,
                'name' => $item->name,
                'type' => $item->type,
                'visibility' => $item->visibility,
            ],
            'shares' => $shares,
        ]);
    }

    /**
     * Revoke (deactivate) a share link or pending transfer.
     *
     * DELETE /drive/shares/{share}
     */
    public function revokeShare(Request $request, DriveShare $share): RedirectResponse
    {
        $this->authorizeShareOwner($request, $share);

        $share->update(['is_active' => false]);

        return redirect()->back()->with('success', 'Share revoked.');
    }

    // =========================================================================
    // PUBLIC SHARE ACCESS  (no auth required)
    // =========================================================================

    /**
     * Render the public share page — or a password-unlock form if protected.
     *
     * GET /s/{token}
     */
    public function shareAccessPage(Request $request, string $token): Response|RedirectResponse
    {
        $share = DriveShare::where('token', $token)
            ->where('type', 'link')
            ->with('driveItem')
            ->firstOrFail();

        if (!$share->isUsable()) {
            return Inertia::render('drive/share-expired', [
                'reason' => $share->isExpired()
                    ? 'expired'
                    : ($share->isExhausted() ? 'exhausted' : 'revoked'),
            ]);
        }

        $unlockedKey = "share_unlocked_{$share->id}";
        $needsPassword = $share->hasPassword()
                      && !$request->session()->get($unlockedKey);

        return Inertia::render('drive/share-access', [
            'share' => [
                'id' => $share->id,
                'token' => $share->token,
                'permission' => $share->permission,
                'has_password' => $share->hasPassword(),
                'needs_unlock' => $needsPassword,
                'expires_at' => $share->expires_at?->toIso8601String(),
                'use_count' => $share->use_count,
                'max_uses' => $share->max_uses,
            ],
            'item' => $needsPassword ? null : [
                'id' => $share->driveItem->id,
                'name' => $share->driveItem->name,
                'type' => $share->driveItem->type,
                'size' => $share->driveItem->size,
                'size_human' => $share->driveItem->formattedSize(),
                'mime_type' => $share->driveItem->mime_type,
                'extension' => $share->driveItem->extension,
            ],
        ]);
    }

    /**
     * Verify the password for a protected share.
     *
     * POST /s/{token}/unlock
     */
    public function unlockShare(Request $request, string $token): RedirectResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $share = DriveShare::where('token', $token)
            ->where('type', 'link')
            ->firstOrFail();

        if (!$share->isUsable()) {
            return redirect()->route('drive.share.access', $token)
                ->withErrors(['password' => 'This link is no longer valid.']);
        }

        if (!Hash::check($validated['password'], $share->password)) {
            return back()->withErrors(['password' => 'Incorrect password.']);
        }

        $request->session()->put("share_unlocked_{$share->id}", true);

        return redirect()->route('drive.share.access', $token);
    }

    /**
     * Stream/download a file through a share link.
     *
     * GET /s/{token}/download
     */
    public function sharedDownload(Request $request, string $token)
    {
        $share = DriveShare::where('token', $token)
            ->where('type', 'link')
            ->where('permission', 'download')
            ->with('driveItem')
            ->firstOrFail();

        if (!$share->isUsable()) {
            abort(410, 'This share link has expired or been revoked.');
        }

        if ($share->hasPassword()
            && !$request->session()->get("share_unlocked_{$share->id}")) {
            return redirect()->route('drive.share.access', $token);
        }

        $item = $share->driveItem;

        if ($item->isFolder() || !$item->path) {
            abort(400, 'Cannot download a folder.');
        }

        $share->recordAccess();

        return Storage::disk($item->disk)->download(
            $item->path,
            $item->original_name ?? $item->name,
        );
    }

    // =========================================================================
    // TRANSFER
    // =========================================================================

    /**
     * Offer ownership of an item to another registered user.
     *
     * POST /drive/items/{item}/transfer
     * Body: { recipient_email: string }
     *
     * Rules:
     *   - Owner cannot transfer to themselves.
     *   - Only one pending transfer per item at a time.
     *   - Item must not be trashed.
     */
    public function initiateTransfer(Request $request, DriveItem $item): RedirectResponse
    {
        $this->authorizeOwner($request, $item);

        if ($item->trashed()) {
            return redirect()->back()->withErrors([
                'recipient_email' => 'Cannot transfer a trashed item. Restore it first.',
            ]);
        }

        if ($item->pendingTransfers()->exists()) {
            return redirect()->back()->withErrors([
                'recipient_email' => 'A transfer for this item is already pending.',
            ]);
        }

        $validated = $request->validate([
            'recipient_email' => ['required', 'email', 'exists:users,email'],
        ]);

        $recipient = User::where('email', $validated['recipient_email'])->firstOrFail();

        if ($recipient->id === $request->user()->id) {
            return redirect()->back()->withErrors([
                'recipient_email' => 'You cannot transfer an item to yourself.',
            ]);
        }

        $share = DriveShare::makeTransfer($item, $recipient);
        $share->save();

        // TODO: dispatch TransferOfferedNotification to $recipient
        // Notification::send($recipient, new TransferOfferedNotification($share));

        return redirect()->back()->with(
            'success',
            "Transfer offer sent to {$recipient->email}."
        );
    }

    /**
     * Cancel a pending transfer that the owner initiated.
     *
     * DELETE /drive/transfer/{token}/cancel
     */
    public function cancelTransfer(Request $request, string $token): RedirectResponse
    {
        $share = DriveShare::where('token', $token)
            ->where('type', 'transfer')
            ->where('transfer_status', 'pending')
            ->where('owner_id', $request->user()->id)
            ->firstOrFail();

        $share->update(['is_active' => false, 'transfer_status' => 'declined']);

        return redirect()->back()->with('success', 'Transfer cancelled.');
    }

    /**
     * Show the transfer acceptance page (recipient lands here from email link).
     *
     * GET /drive/transfer/{token}
     */
    public function transferPage(Request $request, string $token): Response
    {
        $share = DriveShare::where('token', $token)
            ->where('type', 'transfer')
            ->where('transfer_status', 'pending')
            ->where('is_active', true)
            ->with(['driveItem', 'owner:id,name,email'])
            ->firstOrFail();

        if ((int) $share->recipient_id !== (int) $request->user()?->id) {
            abort(403, 'This transfer was not sent to you.');
        }

        return Inertia::render('drive/transfer-accept', [
            'share' => [
                'id' => $share->id,
                'token' => $share->token,
            ],
            'item' => [
                'id' => $share->driveItem->id,
                'name' => $share->driveItem->name,
                'type' => $share->driveItem->type,
                'size_human' => $share->driveItem->formattedSize(),
                'visibility' => $share->driveItem->visibility,
            ],
            'from' => [
                'name' => $share->owner->name,
                'email' => $share->owner->email,
            ],
        ]);
    }

    /**
     * Accept a transfer offer — reassigns ownership atomically.
     *
     * POST /drive/transfer/{token}/accept
     */
    public function acceptTransfer(Request $request, string $token): RedirectResponse
    {
        $share = DriveShare::where('token', $token)
            ->where('type', 'transfer')
            ->where('transfer_status', 'pending')
            ->where('is_active', true)
            ->firstOrFail();

        if ((int) $share->recipient_id !== (int) $request->user()->id) {
            abort(403);
        }

        $share->acceptTransfer();   // DB::transaction inside the model

        return redirect()->route('drive.index')
            ->with('success', "'{$share->driveItem->name}' has been transferred to your drive.");
    }

    /**
     * Decline a transfer offer.
     *
     * POST /drive/transfer/{token}/decline
     */
    public function declineTransfer(Request $request, string $token): RedirectResponse
    {
        $share = DriveShare::where('token', $token)
            ->where('type', 'transfer')
            ->where('transfer_status', 'pending')
            ->where('is_active', true)
            ->firstOrFail();

        if ((int) $share->recipient_id !== (int) $request->user()->id) {
            abort(403);
        }

        $share->declineTransfer();

        return redirect()->route('drive.index')->with('info', 'Transfer declined.');
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private function authorizeOwner(Request $request, DriveItem $item): void
    {
        if ((int) $item->user_id !== (int) $request->user()->id) {
            abort(403);
        }
    }

    private function authorizeShareOwner(Request $request, DriveShare $share): void
    {
        if ((int) $share->owner_id !== (int) $request->user()->id) {
            abort(403);
        }
    }

    private function isDescendant(DriveItem $ancestor, int $targetId): bool
    {
        if ((int) $ancestor->id === $targetId) {
            return true;
        }

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
            'id' => $folder->id,
            'name' => $folder->name,
            'parent_id' => $folder->parent_id,
        ];
    }

    private function shareResource(DriveShare $share): array
    {
        return [
            'id' => $share->id,
            'type' => $share->type,
            'token' => $share->token,
            'url' => $share->type === 'link'
                ? route('drive.share.access', $share->token)
                : route('drive.transfer.page', $share->token),
            'permission' => $share->permission,
            'has_password' => $share->hasPassword(),
            'max_uses' => $share->max_uses,
            'use_count' => $share->use_count,
            'expires_at' => $share->expires_at?->toIso8601String(),
            'is_active' => $share->is_active,
            'is_expired' => $share->isExpired(),
            'is_exhausted' => $share->isExhausted(),
            'transfer_status' => $share->transfer_status,
            'recipient' => $share->recipient ? [
                'id' => $share->recipient->id,
                'name' => $share->recipient->name,
                'email' => $share->recipient->email,
            ] : null,
            'created_at' => $share->created_at->toIso8601String(),
        ];
    }

    /**
     * Bytes used by a user's non-deleted files.
     */
    private function storageUsage(int $userId): int
    {
        return (int) DriveItem::forUser($userId)->files()->sum('size');
    }

    /**
     * Per-user storage limit in bytes.
     *
     * Resolution order:
     *   1. users.storage_limit column  (if you've added it)
     *   2. plan-based mapping          (uncomment to activate)
     *   3. hard-coded 2 GB default
     *
     * To add a per-user column:
     *   php artisan make:migration add_storage_limit_to_users_table
     *   → $table->unsignedBigInteger('storage_limit')->default(2 * 1024 ** 3);
     */
    private function storageLimit(User $user): int
    {
        // Option 1 — column on users table
        if (isset($user->storage_limit)) {
            return (int) $user->storage_limit;
        }

        // Option 2 — plan-based (uncomment when billing is wired up)
        // return match ($user->plan ?? 'free') {
        //     'pro'   => 50  * 1024 ** 3,   // 50 GB
        //     'team'  => 200 * 1024 ** 3,   // 200 GB
        //     default => 2   * 1024 ** 3,   // 2 GB free
        // };

        // Option 3 — global default: 2 GB
        return 2 * 1024 ** 3;
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes === 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = min((int) floor(log($bytes, 1024)), count($units) - 1);

        return round($bytes / (1024 ** $i), 1).' '.$units[$i];
    }
}
