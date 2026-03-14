<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Request;

class ActivityLog extends Model
{
    public $timestamps = false;         // only created_at, managed by DB default

    protected $fillable = [
        'causer_id', 'causer_type',
        'subject_id', 'subject_type',
        'event', 'description', 'module', 'properties',
    ];

    protected $casts = [
        'properties' => 'array',
        'created_at' => 'datetime',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    /** The model that caused the action (usually a User). */
    public function causer(): MorphTo
    {
        return $this->morphTo('causer');
    }

    /** The model that was acted upon. */
    public function subject(): MorphTo
    {
        return $this->morphTo('subject');
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * The primary entry point for the entire codebase.
     *
     * Usage:
     *   ActivityLog::record('uploaded', 'Uploaded report.pdf', 'drive', $driveItem);
     *   ActivityLog::record('created', 'Created new service Web Dev', 'service', $service);
     *   ActivityLog::record('login',   'Logged in',                   'auth');
     *
     * @param  string      $event        Machine-readable verb
     * @param  string      $description  Human-readable sentence shown in the UI
     * @param  string|null $module       App area: drive | vault | service | auth | …
     * @param  Model|null  $subject      The model that was acted on (optional)
     * @param  array       $extra        Any extra data to store in `properties`
     */
    public static function record(
        string $event,
        string $description,
        ?string $module  = null,
        ?Model  $subject = null,
        array   $extra   = [],
    ): self {
        $user = auth()->user();

        $properties = array_merge(
            ['ip' => Request::ip()],
            $extra,
        );

        return static::create([
            'causer_id'    => $user?->id,
            'causer_type'  => $user ? get_class($user) : null,
            'subject_id'   => $subject?->getKey(),
            'subject_type' => $subject ? get_class($subject) : null,
            'event'        => $event,
            'description'  => $description,
            'module'       => $module,
            'properties'   => $properties,
        ]);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    /** Filter to a specific user's actions. */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('causer_id', $userId)
                     ->where('causer_type', \App\Models\User::class);
    }

    /** Filter to a specific module (drive, vault, service, auth…). */
    public function scopeInModule($query, string $module)
    {
        return $query->where('module', $module);
    }

    /** Filter to a specific event verb. */
    public function scopeForEvent($query, string $event)
    {
        return $query->where('event', $event);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Icon name hint for the frontend — maps an event verb to a Lucide icon.
     * The React component uses this to avoid a big switch statement.
     */
    public function iconName(): string
    {
        return match ($this->event) {
            'login', 'logout'                   => 'LogIn',
            'created', 'create'                 => 'Plus',
            'updated', 'update', 'renamed'      => 'Pencil',
            'deleted', 'trashed'                => 'Trash2',
            'restored'                          => 'RotateCcw',
            'uploaded', 'upload'                => 'Upload',
            'downloaded', 'download'            => 'Download',
            'shared', 'share'                   => 'Share2',
            'transferred', 'transfer'           => 'Send',
            'starred'                           => 'Star',
            'visibility_changed'                => 'Globe',
            'password_changed'                  => 'Lock',
            default                             => 'Activity',
        };
    }

    /**
     * Colour class hint for the frontend badge.
     */
    public function colorClass(): string
    {
        return match ($this->event) {
            'deleted', 'trashed'                => 'text-red-500',
            'created', 'uploaded', 'restored'   => 'text-green-500',
            'shared', 'transferred'             => 'text-blue-500',
            'login', 'logout'                   => 'text-purple-500',
            default                             => 'text-muted-foreground',
        };
    }
}
