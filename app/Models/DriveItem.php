<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class DriveItem extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id', 'parent_id', 'type', 'name',
        'mime_type', 'disk', 'path', 'original_name',
        'size', 'extension', 'is_starred',
        'visibility', ];

    protected $casts = [
        'user_id' => 'integer',
        'parent_id' => 'integer',
        'size' => 'integer',
        'is_starred' => 'boolean',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(DriveItem::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(DriveItem::class, 'parent_id')->orderByRaw("type = 'file'");
    }

    /**
     * All share records (links + transfers) for this item.
     */
    public function shares(): HasMany
    {
        return $this->hasMany(DriveShare::class);
    }

    /**
     * Only active share links (type = 'link', is_active = true).
     */
    public function activeShareLinks(): HasMany
    {
        return $this->hasMany(DriveShare::class)
                    ->where('type', 'link')
                    ->where('is_active', true);
    }

    /**
     * Pending transfer offers (type = 'transfer', status = 'pending').
     * Used by the controller to block duplicate transfer attempts.
     */
    public function pendingTransfers(): HasMany
    {
        return $this->hasMany(DriveShare::class)
                    ->where('type', 'transfer')
                    ->where('transfer_status', 'pending')
                    ->where('is_active', true);
    }
    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeFolders($query)
    {
        return $query->where('type', 'folder');
    }

    public function scopeFiles($query)
    {
        return $query->where('type', 'file');
    }

    public function scopeStarred($query)
    {
        return $query->where('is_starred', true);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isFolder(): bool
    {
        return $this->type === 'folder';
    }

    public function isFile(): bool
    {
        return $this->type === 'file';
    }

    /** Human-readable size string */
    public function formattedSize(): string
    {
        if ($this->size === 0) {
            return '—';
        }
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $pow = min((int) floor(log($this->size, 1024)), count($units) - 1);

        return round($this->size / (1024 ** $pow), 1).' '.$units[$pow];
    }

    /**
     * All share records (links + transfers) for this item.
     */
    // public function shares(): HasMany
    // {
    //     return $this->hasMany(DriveShare::class);
    // }

    /**
     * Only active share links (type = 'link', is_active = true).
     */
    // public function activeShareLinks(): HasMany
    // {
    //     return $this->hasMany(DriveShare::class)
    //                 ->where('type', 'link')
    //                 ->where('is_active', true);
    // }

    /**
     * Pending transfer offers (type = 'transfer', status = 'pending').
     * Used by the controller to block duplicate transfer attempts.
     */
    // public function pendingTransfers(): HasMany
    // {
    //     return $this->hasMany(DriveShare::class)
    //                 ->where('type', 'transfer')
    //                 ->where('transfer_status', 'pending')
    //                 ->where('is_active', true);
    // }

    /**
     * Build the breadcrumb ancestry array for this item.
     * Returns ordered list from root → direct parent.
     */
    public function breadcrumbs(): array
    {
        $crumbs = [];
        $node = $this->parent;

        while ($node) {
            array_unshift($crumbs, ['id' => $node->id, 'name' => $node->name]);
            $node = $node->parent;
        }

        return $crumbs;
    }
}
