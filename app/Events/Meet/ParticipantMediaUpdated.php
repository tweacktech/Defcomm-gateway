<?php
namespace App\Events\Meet;
use App\Models\MeetRoom;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;

class ParticipantMediaUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(
        public readonly MeetRoom $room,
        public readonly string $peerId,
        public readonly bool $videoOn,
        public readonly bool $audioOn,
        public readonly bool $screenSharing,
        public readonly bool $handRaised,
    ) {}
    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("meet.{$this->room->uid}");
    }
    public function broadcastAs(): string { return 'meet.media-updated'; }
    public function broadcastWith(): array
    {
        return [
            'peer_id'        => $this->peerId,
            'video_on'       => $this->videoOn,
            'audio_on'       => $this->audioOn,
            'screen_sharing' => $this->screenSharing,
            'hand_raised'    => $this->handRaised,
        ];
    }
}
