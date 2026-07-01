<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FileShare extends Model
{
    use HasFactory;

    protected $fillable = [
        'file_id',
        'shared_by_user_id',
        'shared_with_user_id',
        'permission',
        'expires_at',
        'accessed_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'accessed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * The file being shared
     */
    public function file(): BelongsTo
    {
        return $this->belongsTo(File::class);
    }

    /**
     * User who initiated the share
     */
    public function sharedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shared_by_user_id');
    }

    /**
     * User who received the share
     */
    public function sharedWith(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shared_with_user_id');
    }

    /**
     * Check if share is still valid (not expired)
     */
    public function isValid(): bool
    {
        if ($this->expires_at === null) {
            return true;
        }

        return $this->expires_at->isFuture();
    }

    /**
     * Check if user can edit with this permission
     */
    public function canEdit(): bool
    {
        return $this->permission === 'edit' && $this->isValid();
    }

    /**
     * Check if user can download with this permission
     */
    public function canDownload(): bool
    {
        return in_array($this->permission, ['download', 'edit']) && $this->isValid();
    }

    /**
     * Update last access time
     */
    public function recordAccess(): void
    {
        $this->update(['accessed_at' => now()]);
    }
}
