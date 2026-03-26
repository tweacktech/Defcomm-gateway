<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeetParticipant extends Model
{
    protected $fillable = [
        'room_id',
        'user_id',
        'display_name',
        'peer_id',
        'avatar_url',
        'role',
        'is_admitted',
        'video_on',
        'audio_on',
        'screen_sharing',
        'hand_raised',
        'socket_id',
        'joined_at',
        'left_at',
        'duration_seconds',
    ];

    protected $casts = [
        'is_admitted' => 'boolean',
        'video_on' => 'boolean',
        'audio_on' => 'boolean',
        'screen_sharing' => 'boolean',
        'hand_raised' => 'boolean',
        'joined_at' => 'datetime',
        'left_at' => 'datetime',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function room(): BelongsTo
    {
        return $this->belongsTo(MeetRoom::class, 'room_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isHost(): bool
    {
        return $this->role === 'host';
    }

    public function isCoHost(): bool
    {
        return $this->role === 'co-host';
    }

    public function canModerate(): bool
    {
        return in_array($this->role, ['host', 'co-host']);
    }

    public function isActive(): bool
    {
        return $this->left_at === null && $this->is_admitted;
    }

    /**
     * Mark participant as having left and calculate duration.
     */
    public function leave(): void
    {
        // absolute=true prevents negative when joined_at has clock skew.
        // max(0, ...) guards against any remaining edge case.
        // (int) floors the float — the column is unsignedInteger.
        $duration = $this->joined_at
            ? max(0, (int) now()->diffInSeconds($this->joined_at, true))
            : 0;

        $this->update([
            'left_at' => now(),
            'duration_seconds' => $duration,
        ]);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->whereNull('left_at')->where('is_admitted', true);
    }

    public function scopeWaiting($query)
    {
        return $query->whereNull('left_at')->where('is_admitted', false);
    }

    public function scopeHosts($query)
    {
        return $query->whereIn('role', ['host', 'co-host']);
    }
}
