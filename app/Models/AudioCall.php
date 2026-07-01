<?php
// ═══════════════════════════════════════════════════════════════════════════════
// app/Models/AudioCall.php
// ═══════════════════════════════════════════════════════════════════════════════

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class AudioCall extends Model
{
    protected $fillable = [
        'uid', 'title', 'initiator_id', 'app_key',
        'priority', 'priority_note',
        'mode', 'callee_id', 'max_participants',
        'password', 'waiting_room', 'mute_on_join', 'record_enabled',
        'status', 'started_at', 'ended_at', 'duration_seconds',
        'webhook_url', 'webhook_events',
    ];

    protected $casts = [
        'waiting_room'    => 'boolean',
        'mute_on_join'    => 'boolean',
        'record_enabled'  => 'boolean',
        'webhook_events'  => 'array',
        'started_at'      => 'datetime',
        'ended_at'        => 'datetime',
    ];

    // Priority ordering for sorting / preemption
    public const PRIORITY_ORDER = [
        'routine'   => 0,
        'important' => 1,
        'urgent'    => 2,
        'emergency' => 3,
    ];

    // ── Boot ──────────────────────────────────────────────────────────────────

    protected static function booted(): void
    {
        static::creating(function (self $call) {
            $call->uid = $call->uid ?? self::generateUid();
        });
    }

    public static function generateUid(): string
    {
        do {
            $uid = 'ac-' . Str::lower(Str::random(4)) . '-' . Str::lower(Str::random(4));
        } while (self::where('uid', $uid)->exists());
        return $uid;
    }

    // ── Relationships ─────────────────────────────────────────────────────────

    public function initiator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiator_id');
    }

    public function callee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'callee_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(AudioCallParticipant::class, 'call_id');
    }

    public function activeParticipants(): HasMany
    {
        return $this->hasMany(AudioCallParticipant::class, 'call_id')
            ->where('status', 'joined');
    }

    // ── State helpers ─────────────────────────────────────────────────────────

    public function isActive(): bool   { return $this->status === 'active'; }
    public function isPending(): bool  { return $this->status === 'pending'; }
    public function isEnded(): bool    { return in_array($this->status, ['ended', 'missed', 'declined']); }
    public function isFull(): bool     { return $this->activeParticipants()->count() >= $this->max_participants; }
    public function hasPassword(): bool { return !empty($this->password); }
    public function priorityLevel(): int { return self::PRIORITY_ORDER[$this->priority] ?? 0; }

    public function start(): void
    {
        $this->update(['status' => 'active', 'started_at' => now()]);
    }

    public function end(string $status = 'ended'): void
    {
        $duration = $this->started_at
            ? max(0, (int) now()->diffInSeconds($this->started_at, true))
            : 0;

        $this->update([
            'status'           => $status,
            'ended_at'         => now(),
            'duration_seconds' => $duration,
        ]);
    }

    public function hold(): void   { $this->update(['status' => 'on_hold']); }
    public function resume(): void { $this->update(['status' => 'active']); }

    // ── Priority display helpers ───────────────────────────────────────────────

    public function priorityColor(): string
    {
        return match ($this->priority) {
            'routine'   => 'zinc',
            'important' => 'blue',
            'urgent'    => 'orange',
            'emergency' => 'red',
            default     => 'zinc',
        };
    }

    public function priorityLabel(): string
    {
        return ucfirst($this->priority);
    }

    // Returns true if this call should interrupt another call of lower priority
    public function shouldPreempt(AudioCall $other): bool
    {
        return $this->priorityLevel() > $other->priorityLevel();
    }
}