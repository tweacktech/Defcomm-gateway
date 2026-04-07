<?php
// app/Models/AudioCallParticipant.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AudioCallParticipant extends Model
{
    protected $fillable = [
        'call_id', 'user_id', 'peer_id', 'display_name', 'avatar_url',
        'role', 'is_admitted', 'audio_on', 'hand_raised', 'is_muted_by_host',
        'status', 'joined_at', 'left_at', 'duration_seconds',
    ];

    protected $casts = [
        'is_admitted'      => 'boolean',
        'audio_on'         => 'boolean',
        'hand_raised'      => 'boolean',
        'is_muted_by_host' => 'boolean',
        'joined_at'        => 'datetime',
        'left_at'          => 'datetime',
    ];

    public function call(): BelongsTo
    {
        return $this->belongsTo(AudioCall::class, 'call_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function leave(string $status = 'left'): void
    {
        $duration = $this->joined_at
            ? max(0, (int) now()->diffInSeconds($this->joined_at, true))
            : 0;

        $this->update([
            'status'           => $status,
            'left_at'          => now(),
            'duration_seconds' => $duration,
        ]);
    }

    public function isActive(): bool { return $this->status === 'joined'; }
    public function isHost(): bool   { return $this->role === 'host'; }
}