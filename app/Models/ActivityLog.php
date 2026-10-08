<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Request;

class ActivityLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'causer_id', 'causer_type',
        'subject_id', 'subject_type',
        'event', 'description', 'module',
        'organization_id', 'properties',
    ];

    protected $casts = [
        'properties' => 'array',
        'created_at' => 'datetime',
    ];

    public function causer(): MorphTo
    {
        return $this->morphTo('causer');
    }

    public function subject(): MorphTo
    {
        return $this->morphTo('subject');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * @param  string      $event        Machine-readable verb
     * @param  string      $description  Human-readable sentence shown in the UI
     * @param  string|null $module       App area: drive | vault | service | auth | …
     * @param  Model|null  $subject      The model that was acted on (optional)
     * @param  array       $extra        Extra data for `properties` (may include organization_id)
     */
    public static function record(
        string $event,
        string $description,
        ?string $module = null,
        ?Model $subject = null,
        array $extra = [],
    ): self {
        $user = auth()->user();

        $organizationId = $extra['organization_id']
            ?? (isset($subject->organization_id) ? $subject->organization_id : null)
            ?? $user?->organization_id
            ?? null;

        unset($extra['organization_id']);

        $properties = array_merge(
            ['ip' => Request::ip()],
            $extra,
        );

        return static::create([
            'causer_id' => $user?->id,
            'causer_type' => $user ? get_class($user) : null,
            'subject_id' => $subject?->getKey(),
            'subject_type' => $subject ? get_class($subject) : null,
            'event' => $event,
            'description' => $description,
            'module' => $module,
            'organization_id' => $organizationId,
            'properties' => $properties,
        ]);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('causer_id', $userId)
            ->where('causer_type', User::class);
    }

    public function scopeForOrganization($query, int $organizationId)
    {
        return $query->where('organization_id', $organizationId);
    }

    public function scopeInModule($query, string $module)
    {
        return $query->where('module', $module);
    }

    public function scopeForEvent($query, string $event)
    {
        return $query->where('event', $event);
    }

    public function iconName(): string
    {
        return match ($this->event) {
            'login', 'logout' => 'LogIn',
            'created', 'create' => 'Plus',
            'updated', 'update', 'renamed' => 'Pencil',
            'deleted', 'trashed' => 'Trash2',
            'restored' => 'RotateCcw',
            'uploaded', 'upload' => 'Upload',
            'downloaded', 'download' => 'Download',
            'shared', 'share' => 'Share2',
            'transferred', 'transfer' => 'Send',
            'starred' => 'Star',
            'visibility_changed' => 'Globe',
            'password_changed' => 'Lock',
            default => 'Activity',
        };
    }

    public function colorClass(): string
    {
        return match ($this->event) {
            'deleted', 'trashed' => 'text-red-500',
            'created', 'uploaded', 'restored' => 'text-green-500',
            'shared', 'transferred' => 'text-blue-500',
            'login', 'logout' => 'text-purple-500',
            default => 'text-muted-foreground',
        };
    }
}
