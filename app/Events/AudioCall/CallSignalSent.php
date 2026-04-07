<?php

namespace App\Events\AudioCall;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallSignalSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $callUid,
        public readonly string $from,
        public readonly string $to,
        public readonly string $type,
        public readonly mixed  $payload
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("call.{$this->callUid}");
    }

    public function broadcastAs(): string
    {
        return 'call.signal';
    }

    public function broadcastWith(): array
    {
        return ['from'=>$this->from,'to'=>$this->to,'type'=>$this->type,'payload'=>$this->payload];
    }
}
