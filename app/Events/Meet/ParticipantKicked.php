<?php


namespace App\Events\Meet;

use App\Models\MeetParticipant;
use App\Models\MeetRoom;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Facades\Log;


class ParticipantKicked implements ShouldBroadcast
{
    public function __construct(
        public readonly string $roomUid,
        public readonly string $peerId,
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("meet.{$this->roomUid}");
    }

    public function broadcastAs(): string { return 'meet.participant-kicked'; }

    public function broadcastWith(): array {
         Log::info('ParticipantKicked event');
    return ['peer_id' => $this->peerId]; }
}
