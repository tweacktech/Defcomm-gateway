<?php
namespace App\Events\Meet;
use App\Models\MeetRoom;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class RecordingStopped implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(
        public readonly MeetRoom $room,
        public readonly int $recordingId,
    ) {}
    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("meet.{$this->room->uid}");
    }
    public function broadcastAs(): string { return 'meet.recording-stopped'; }
    public function broadcastWith(): array
    {
        return ['recording_id' => $this->recordingId];
    }
}
