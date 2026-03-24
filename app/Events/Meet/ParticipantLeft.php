<?php

namespace App\Events\Meet;

use App\Models\MeetParticipant;
use App\Models\MeetRoom;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Facades\Log;

class ParticipantLeft implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public readonly MeetRoom        $room,
        public readonly MeetParticipant $participant,
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("meet.{$this->room->uid}");
    }

    public function broadcastAs(): string { return 'meet.participant-left'; }

    public function broadcastWith(): array
    {
        Log::info('ParticipantLeft event');
        return ['peer_id' => $this->participant->peer_id];
    }
}
