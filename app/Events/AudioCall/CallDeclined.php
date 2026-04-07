<?php

namespace App\Events\AudioCall;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallDeclined implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $callUid,
        public readonly string $displayName
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("call.{$this->callUid}");
    }

    public function broadcastAs(): string
    {
        return 'call.declined';
    }

    public function broadcastWith(): array
    {
        return ['uid'=>$this->callUid,'declined_by'=>$this->displayName,'declined_at'=>now()->toIso8601String()];
    }
}
