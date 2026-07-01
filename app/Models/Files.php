<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Services\FileEncryptionService;

class File extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'filename_encrypted',
        'path',
        'mime_type',
        'size',
        'hash',
        'description',
        'visibility',
        'encryption_algorithm',
        'is_encrypted',
    ];

    protected $casts = [
        'size' => 'integer',
        'is_encrypted' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Get encryption service
     */
    protected function getEncryptionService(): FileEncryptionService
    {
        return app(FileEncryptionService::class);
    }

    /**
     * Get decrypted filename attribute
     */
    public function getDecryptedFilenameAttribute(): string
    {
        try {
            return $this->getEncryptionService()->decryptFileMetadata($this->filename_encrypted);
        } catch (\Exception $e) {
            \Log::warning('Failed to decrypt filename', ['file_id' => $this->id]);
            return 'encrypted_file';
        }
    }

    /**
     * Get decrypted description attribute
     */
    public function getDecryptedDescriptionAttribute(): ?string
    {
        if (!$this->description) {
            return null;
        }

        try {
            return $this->getEncryptionService()->decryptFileMetadata($this->description);
        } catch (\Exception $e) {
            \Log::warning('Failed to decrypt description', ['file_id' => $this->id]);
            return null;
        }
    }

    /**
     * Owner of the file
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * All shares for this file
     */
    public function shares(): HasMany
    {
        return $this->hasMany(FileShare::class);
    }

    /**
     * Users with access to this file
     */
    public function sharedWith()
    {
        return $this->belongsToMany(
            User::class,
            'file_shares',
            'file_id',
            'shared_with_user_id'
        )->withPivot('permission', 'expires_at', 'accessed_at')
            ->withTimestamps();
    }

    /**
     * Check if user has access to this file
     */
    public function canAccess(User $user): bool
    {
        // Owner always has access
        if ($this->user_id === $user->id) {
            return true;
        }

        // Check if publicly visible
        if ($this->visibility === 'public') {
            return true;
        }

        // Check explicit share
        return $this->shares()
            ->where('shared_with_user_id', $user->id)
            ->where(function ($query) {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->exists();
    }

    /**
     * Get permission level for user
     */
    public function getPermission(User $user): ?string
    {
        if ($this->user_id === $user->id) {
            return 'own';
        }

        if ($this->visibility === 'public') {
            return 'view';
        }

        return $this->shares()
            ->where('shared_with_user_id', $user->id)
            ->where(function ($query) {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->value('permission');
    }

    /**
     * Generate download filename (decrypted)
     */
    public function getDownloadName(): string
    {
        return $this->decrypted_filename;
    }

    /**
     * Get file extension from decrypted filename
     */
    public function getExtension(): string
    {
        return pathinfo($this->decrypted_filename, PATHINFO_EXTENSION);
    }

    /**
     * Format file size for display
     */
    public function getFormattedSize(): string
    {
        $bytes = $this->size;
        $units = ['B', 'KB', 'MB', 'GB'];

        for ($i = 0; $i < count($units) && $bytes >= 1024; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    /**
     * Decrypt file content
     */
    public function decryptContent(): string|false
    {
        if (!$this->is_encrypted) {
            return \Illuminate\Support\Facades\Storage::disk('private')->get($this->path);
        }

        return $this->getEncryptionService()->decryptAndRetrieve($this->path);
    }

    /**
     * Stream decrypt file (memory efficient for large files)
     */
    public function streamDecryptContent()
    {
        if (!$this->is_encrypted) {
            return \Illuminate\Support\Facades\Storage::disk('private')->readStream($this->path);
        }

        return $this->getEncryptionService()->streamDecrypt($this->path);
    }
}
