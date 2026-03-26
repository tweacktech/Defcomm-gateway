<?php
namespace App\Events\Meet;
use App\Models\MeetParticipant;
use App\Models\MeetRoom;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class ParticipantWaiting implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(
        public readonly MeetRoom $room,
        public readonly MeetParticipant $participant,
    ) {}
    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("meet.{$this->room->uid}");
    }
    public function broadcastAs(): string { return 'meet.participant-waiting'; }
    public function broadcastWith(): array
    {
        return [
            'peer_id'      => $this->participant->peer_id,
            'display_name' => $this->participant->display_name,
            'role'         => $this->participant->role,
        ];
    }
}
