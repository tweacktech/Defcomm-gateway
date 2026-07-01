<?php
// app/Models/MeetRoom.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class MeetRoom extends Model
{
    protected $fillable = [
        'uid', 'name', 'slug', 'owner_id', 'app_key',
        'password', 'max_participants',
        'video_enabled', 'audio_enabled', 'chat_enabled',
        'screen_share_enabled', 'recording_enabled', 'waiting_room',
        'allowed_hosts', 'status',
        'scheduled_at', 'started_at', 'ended_at', 'duration_seconds',
        'webhook_url', 'webhook_events',
    ];

    protected $casts = [
        'video_enabled'         => 'boolean',
        'audio_enabled'         => 'boolean',
        'chat_enabled'          => 'boolean',
        'screen_share_enabled'  => 'boolean',
        'recording_enabled'     => 'boolean',
        'waiting_room'          => 'boolean',
        'allowed_hosts'         => 'array',
        'webhook_events'        => 'array',
        'scheduled_at'          => 'datetime',
        'started_at'            => 'datetime',
        'ended_at'              => 'datetime',
    ];

    // ── Boot ──────────────────────────────────────────────────────────────────

    protected static function booted(): void
    {
        static::creating(function (self $room) {
            $room->uid = $room->uid ?? self::generateUid();
        });
    }

    public static function generateUid(): string
    {
        do {
            $uid = implode('-', [
                Str::lower(Str::random(4)),
                Str::lower(Str::random(4)),
                Str::lower(Str::random(4)),
            ]);
        } while (self::where('uid', $uid)->exists());

        return $uid;
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(MeetParticipant::class, 'room_id');
    }

    public function activeParticipants(): HasMany
    {
        return $this->hasMany(MeetParticipant::class, 'room_id')
                    ->whereNull('left_at')
                    ->where('is_admitted', true);
    }

    public function waitingParticipants(): HasMany
    {
        return $this->hasMany(MeetParticipant::class, 'room_id')
                    ->whereNull('left_at')
                    ->where('is_admitted', false);
    }

    public function recordings(): HasMany
    {
        return $this->hasMany(MeetRecording::class, 'room_id');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isEnded(): bool
    {
        return $this->status === 'ended';
    }

    public function hasPassword(): bool
    {
        return $this->password !== null;
    }

    public function isFull(): bool
    {
        return $this->activeParticipants()->count() >= $this->max_participants;
    }

    /**
     * Generate a JWT-style join token for SDK consumers.
     * The token is opaque to the client and verified server-side.
     */
    public function joinToken(?int $userId = null, string $displayName = 'Guest'): string
    {
        $payload = json_encode([
            'room_uid' => $this->uid,
            'app_key'  => $this->app_key,
            'user_id'  => $userId,
            'name'     => $displayName,
            'exp'       => now()->addHours(2)->timestamp,
        ]);

        return base64_encode(Crypt::encryptString($payload));
    }

    /**
     * Broadcast channel name — used by Reverb.
     */
    public function channelName(): string
    {
        return "meet.{$this->uid}";
    }

    public function start(): void
    {
        $this->update(['status' => 'active', 'started_at' => now()]);
    }

    public function end(): void
    {
        $duration = $this->started_at
            ? now()->diffInSeconds($this->started_at)
            : 0;

            \Log::error('',['MeetRoom doration'=>$duration]);

        $this->update([
            'status'           => 'ended',
            'ended_at'         => now(),
            'duration_seconds' => $duration,
        ]);

        // Stamp all still-active participants
        $this->activeParticipants()->each(fn ($p) => $p->leave());
    }
}
