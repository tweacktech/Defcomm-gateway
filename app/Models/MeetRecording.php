<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class MeetRecording extends Model
{
    protected $fillable = [
        'room_id',
        'initiated_by',
        'disk',
        'path',
        'size',
        'duration_seconds',
        'status',
        'started_at',
        'ended_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at'   => 'datetime',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function room(): BelongsTo
    {
        return $this->belongsTo(MeetRoom::class, 'room_id');
    }

    public function initiatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isReady(): bool
    {
        return $this->status === 'ready';
    }

    public function isRecording(): bool
    {
        return $this->status === 'recording';
    }

    /**
     * Human-readable file size.
     */
    public function formattedSize(): string
    {
        if (!$this->size) return '—';
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = min((int) floor(log($this->size, 1024)), count($units) - 1);
        return round($this->size / (1024 ** $i), 1) . ' ' . $units[$i];
    }

    /**
     * Human-readable duration.
     */
    public function formattedDuration(): string
    {
        if (!$this->duration_seconds) return '—';
        $h = intdiv($this->duration_seconds, 3600);
        $m = intdiv($this->duration_seconds % 3600, 60);
        $s = $this->duration_seconds % 60;
        return $h > 0
            ? sprintf('%d:%02d:%02d', $h, $m, $s)
            : sprintf('%d:%02d', $m, $s);
    }

    /**
     * Generate a download URL for the recording file.
     */
    public function downloadUrl(): string
    {
        if (!$this->path) return '';

        if ($this->disk === 'local') {
            return route('meet.recording.download', $this->id);
        }

        // S3 or other cloud — temporary signed URL
        return Storage::disk($this->disk)->temporaryUrl(
            $this->path,
            now()->addMinutes(30),
        );
    }

    /**
     * Mark recording as finished and compute duration.
     */
    public function finish(): void
    {
        $duration = $this->started_at
            ? now()->diffInSeconds($this->started_at)
            : 0;

        $this->update([
            'status'           => 'processing',
            'ended_at'         => now(),
            'duration_seconds' => $duration,
        ]);
    }
}
