<?php

namespace App\Events\AudioCall;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ParticipantKickedFromCall implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $callUid,
        public readonly string $peerId
    ) {
    }

    public function broadcastOn(): PresenceChannel
    {
        \Log::info('ParticipantKickedFromCall event');
        return new PresenceChannel("call.{$this->callUid}");
    }

    public function broadcastAs(): string
    {
        return 'call.participant-kicked';
    }

    public function broadcastWith(): array
    {
        return ['peer_id' => $this->peerId];
    }
}
