<?php
namespace App\Events\Meet;
use App\Models\MeetRoom;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class RecordingStarted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(
        public readonly MeetRoom $room,
        public readonly int $recordingId,
        public readonly string $initiatedBy,
    ) {}
    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("meet.{$this->room->uid}");
    }
    public function broadcastAs(): string { return 'meet.recording-started'; }
    public function broadcastWith(): array
    {
        return [
            'recording_id'  => $this->recordingId,
            'initiated_by'  => $this->initiatedBy,
            'started_at'    => now()->toIso8601String(),
        ];
    }
}
