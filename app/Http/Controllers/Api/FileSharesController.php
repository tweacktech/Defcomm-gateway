<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\FileShare;
use App\Models\User;
use App\Services\FileEncryptionService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FileSharesController extends Controller
{
    protected FileEncryptionService $encryptionService;

    public function __construct(FileEncryptionService $encryptionService)
    {
        $this->encryptionService = $encryptionService;
    }

    /**
     * Validate user exists and return user instance
     */
    private function getUserOrFail(int $userId): User
    {
        $user = User::find($userId);
        if (!$user) {
            abort(404, 'User not found');
        }
        return $user;
    }

    /**
     * Get all files accessible to user
     * GET /api/files?user_id=1
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);
        $perPage = $validated['per_page'] ?? 15;

        $files = File::where('user_id', $user->id)
            ->orWhereHas('sharedWith', function ($query) use ($user) {
                $query->where('shared_with_user_id', $user->id)
                    ->where(function ($q) {
                        $q->whereNull('expires_at')
                            ->orWhere('expires_at', '>', now());
                    });
            })
            ->orWhere('visibility', 'public')
            ->with(['owner', 'shares.sharedWith'])
            ->paginate($perPage);

        return response()->json([
            'data' => $files->map(fn($file) => $this->fileResource($file, $user)),
            'pagination' => [
                'total' => $files->total(),
                'per_page' => $files->perPage(),
                'current_page' => $files->currentPage(),
                'last_page' => $files->lastPage(),
            ],
        ]);
    }

    /**
     * Upload a new file with encryption
     * POST /api/files
     * Body: user_id, file, name, description, visibility
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'file' => 'required|file|max:104857600', // 100MB max
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'visibility' => 'required|in:private,shared,public',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);
        $uploadedFile = $request->file('file');

        try {
            // Calculate hash of original file for deduplication
            $hash = hash_file('sha256', $uploadedFile->getRealPath());

            // Check for duplicates
            $duplicate = File::where('hash', $hash)
                ->where('user_id', $user->id)
                ->first();

            if ($duplicate) {
                return response()->json([
                    'message' => 'File already uploaded',
                    'data' => $this->fileResource($duplicate, $user),
                ], 409);
            }

            // Generate encrypted storage filename
            $encryptedStorageName = $this->encryptionService->generateEncryptedStorageName();
            $storagePath = "files/{$user->id}/" . $encryptedStorageName;

            // Encrypt and store file
            $tempPath = $uploadedFile->getRealPath();
            $encrypted = $this->encryptionService->encryptAndStore(
                $tempPath,
                $storagePath,
                'private'
            );

            if (!$encrypted) {
                return response()->json([
                    'message' => 'Failed to encrypt and store file',
                ], 500);
            }

            // Encrypt metadata
            $encryptedFilename = $this->encryptionService->encryptFileMetadata(
                $uploadedFile->getClientOriginalName()
            );
            $encryptedDescription = $validated['description']
                ? $this->encryptionService->encryptFileMetadata($validated['description'])
                : null;

            // Create file record
            $file = File::create([
                'user_id' => $user->id,
                'name' => $validated['name'],
                'filename_encrypted' => $encryptedFilename,
                'path' => $storagePath,
                'mime_type' => $uploadedFile->getMimeType(),
                'size' => $uploadedFile->getSize(),
                'hash' => $hash,
                'description' => $encryptedDescription,
                'visibility' => $validated['visibility'],
                'encryption_algorithm' => config('app.cipher'),
                'is_encrypted' => true,
            ]);

            return response()->json([
                'message' => 'File uploaded and encrypted successfully',
                'data' => $this->fileResource($file, $user),
            ], 201);

        } catch (\Exception $e) {
            \Log::error('File upload failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'File upload failed',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get single file details
     * GET /api/files/{id}?user_id=1
     */
    public function show(File $file, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);

        if (!$file->canAccess($user)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json([
            'data' => $this->fileResource($file, $user),
        ]);
    }

    /**
     * Update file metadata
     * PUT /api/files/{id}
     * Body: user_id, name, description, visibility
     */
    public function update(File $file, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'visibility' => 'required|in:private,shared,public',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);

        if ($file->user_id !== $user->id) {
            return response()->json(['message' => 'Only file owner can update'], 403);
        }

        try {
            // Encrypt description if provided
            $encryptedDescription = $validated['description']
                ? $this->encryptionService->encryptFileMetadata($validated['description'])
                : null;

            $file->update([
                'name' => $validated['name'],
                'description' => $encryptedDescription,
                'visibility' => $validated['visibility'],
            ]);

            return response()->json([
                'message' => 'File updated successfully',
                'data' => $this->fileResource($file, $user),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update file',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a file
     * DELETE /api/files/{id}?user_id=1
     */
    public function destroy(File $file, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);

        if ($file->user_id !== $user->id) {
            return response()->json(['message' => 'Only file owner can delete'], 403);
        }

        try {
            // Securely delete physical file
            if (Storage::disk('private')->exists($file->path)) {
                Storage::disk('private')->delete($file->path);
            }

            // Soft delete will cascade to shares
            $file->delete();

            return response()->json(['message' => 'File deleted successfully']);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to delete file',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Download a file (automatically decrypts)
     * GET /api/files/{id}/download?user_id=1
     */
    public function download(File $file, Request $request): StreamedResponse|JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);
        $permission = $file->getPermission($user);

        if (!$file->canAccess($user)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($permission !== 'own' && $permission !== 'download' && $permission !== 'edit' && $file->visibility !== 'public') {
            return response()->json(['message' => 'Download not permitted'], 403);
        }

        try {
            // Record access if shared
            if ($permission && $permission !== 'own') {
                $share = $file->shares()
                    ->where('shared_with_user_id', $user->id)
                    ->first();
                $share?->recordAccess();
            }

            // Decrypt file content
            $fileContent = $file->decryptContent();

            if ($fileContent === false) {
                return response()->json([
                    'message' => 'Failed to decrypt file',
                ], 500);
            }

            // Return as download
            return response()->streamDownload(
                function () use ($fileContent) {
                    echo $fileContent;
                },
                $file->getDownloadName()
            );

        } catch (\Exception $e) {
            \Log::error('File download failed', [
                'file_id' => $file->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to download file',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Preview file (get decrypted content)
     * GET /api/files/{id}/preview?user_id=1
     */
    public function preview(File $file, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);

        if (!$file->canAccess($user)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $content = $file->decryptContent();

            if ($content === false) {
                return response()->json([
                    'message' => 'Failed to decrypt file',
                ], 500);
            }

            return response()->json([
                'data' => [
                    'filename' => $file->getDownloadName(),
                    'content' => base64_encode($content),
                    'mime_type' => $file->mime_type,
                    'size' => $file->size,
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to preview file',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Share file with another user
     * POST /api/files/{id}/share
     * Body: user_id (owner), share_with_user_id (recipient), permission, expires_at
     */
    public function shareWith(File $file, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'share_with_user_id' => 'required|integer|exists:users,id|different:user_id',
            'permission' => 'required|in:view,download,edit',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);
        $shareWithUser = $this->getUserOrFail($validated['share_with_user_id']);

        if ($file->user_id !== $user->id) {
            return response()->json(['message' => 'Only file owner can share'], 403);
        }

        // Check if already shared
        $existingShare = FileShare::where('file_id', $file->id)
            ->where('shared_with_user_id', $shareWithUser->id)
            ->first();

        if ($existingShare) {
            $existingShare->update([
                'permission' => $validated['permission'],
                'expires_at' => $validated['expires_at'] ?? null,
            ]);

            return response()->json([
                'message' => 'Share updated',
                'data' => $this->shareResource($existingShare),
            ]);
        }

        $share = FileShare::create([
            'file_id' => $file->id,
            'shared_by_user_id' => $user->id,
            'shared_with_user_id' => $shareWithUser->id,
            'permission' => $validated['permission'],
            'expires_at' => $validated['expires_at'] ?? null,
        ]);

        return response()->json([
            'message' => 'File shared successfully',
            'data' => $this->shareResource($share),
        ], 201);
    }

    /**
     * Get all shares for a file
     * GET /api/files/{id}/shares?user_id=1
     */
    public function getShares(File $file, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);

        if ($file->user_id !== $user->id) {
            return response()->json(['message' => 'Only file owner can view shares'], 403);
        }

        $shares = $file->shares()
            ->with(['sharedWith'])
            ->get();

        return response()->json([
            'data' => $shares->map(fn($share) => $this->shareResource($share)),
        ]);
    }

    /**
     * Update share permission
     * PATCH /api/shares/{id}
     * Body: user_id (owner), permission, expires_at
     */
    public function updateShare(FileShare $share, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'permission' => 'required|in:view,download,edit',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);

        // Only file owner can update shares
        if ($share->file->user_id !== $user->id) {
            return response()->json(['message' => 'Only file owner can update shares'], 403);
        }

        $share->update([
            'permission' => $validated['permission'],
            'expires_at' => $validated['expires_at'] ?? null,
        ]);

        return response()->json([
            'message' => 'Share updated successfully',
            'data' => $this->shareResource($share),
        ]);
    }

    /**
     * Revoke share access
     * DELETE /api/shares/{id}?user_id=1
     */
    public function revokeShare(FileShare $share, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);

        // Only file owner can revoke shares
        if ($share->file->user_id !== $user->id) {
            return response()->json(['message' => 'Only file owner can revoke shares'], 403);
        }

        $share->delete();

        return response()->json(['message' => 'Share revoked successfully']);
    }

    /**
     * Get files shared with user
     * GET /api/shared-with-me?user_id=1
     */
    public function sharedWithMe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);
        $perPage = $validated['per_page'] ?? 15;

        $files = File::whereHas('sharedWith', function ($query) use ($user) {
            $query->where('shared_with_user_id', $user->id)
                ->where(function ($q) {
                    $q->whereNull('expires_at')
                        ->orWhere('expires_at', '>', now());
                });
        })
            ->with(['owner', 'shares'])
            ->paginate($perPage);

        return response()->json([
            'data' => $files->map(fn($file) => $this->fileResource($file, $user)),
            'pagination' => [
                'total' => $files->total(),
                'per_page' => $files->perPage(),
                'current_page' => $files->currentPage(),
                'last_page' => $files->lastPage(),
            ],
        ]);
    }

    /**
     * Get files owned by user
     * GET /api/my-files?user_id=1
     */
    public function myFiles(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $user = $this->getUserOrFail($validated['user_id']);
        $perPage = $validated['per_page'] ?? 15;

        $files = File::where('user_id', $user->id)
            ->with(['shares.sharedWith'])
            ->paginate($perPage);

        return response()->json([
            'data' => $files->map(fn($file) => $this->fileResource($file, $user)),
            'pagination' => [
                'total' => $files->total(),
                'per_page' => $files->perPage(),
                'current_page' => $files->currentPage(),
                'last_page' => $files->lastPage(),
            ],
        ]);
    }

    /**
     * Format file as API resource
     */
    private function fileResource(File $file, $user): array
    {
        $permission = $file->getPermission($user);

        return [
            'id' => $file->id,
            'name' => $file->name,
            'filename' => $file->decrypted_filename,
            'description' => $file->decrypted_description,
            'size' => $file->size,
            'formatted_size' => $file->getFormattedSize(),
            'mime_type' => $file->mime_type,
            'extension' => $file->getExtension(),
            'visibility' => $file->visibility,
            'permission' => $permission,
            'is_encrypted' => $file->is_encrypted,
            'encryption_algorithm' => $file->encryption_algorithm,
            'owner' => [
                'id' => $file->owner->id,
                'name' => $file->owner->name,
                'email' => $file->owner->email,
            ],
            'shares_count' => $file->shares->count(),
            'created_at' => $file->created_at,
            'updated_at' => $file->updated_at,
        ];
    }

    /**
     * Format share as API resource
     */
    private function shareResource(FileShare $share): array
    {
        return [
            'id' => $share->id,
            'file_id' => $share->file_id,
            'file_name' => $share->file->name,
            'shared_with' => [
                'id' => $share->sharedWith->id,
                'name' => $share->sharedWith->name,
                'email' => $share->sharedWith->email,
            ],
            'permission' => $share->permission,
            'is_valid' => $share->isValid(),
            'expires_at' => $share->expires_at,
            'accessed_at' => $share->accessed_at,
            'created_at' => $share->created_at,
        ];
    }
}
