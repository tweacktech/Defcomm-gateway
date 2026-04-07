<?php

namespace App\Events\AudioCall;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ParticipantMuted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $callUid,
        public readonly string $peerId,
        public readonly bool   $muted,
        public readonly bool   $byHost = false
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("call.{$this->callUid}");
    }

    public function broadcastAs(): string
    {
        return 'call.participant-muted';
    }

    public function broadcastWith(): array
    {
        return ['peer_id'=>$this->peerId,'muted'=>$this->muted,'by_host'=>$this->byHost];
    }
}
