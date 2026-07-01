<?php

namespace App\Events\AudioCall;

use App\Models\AudioCall;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallEnded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly AudioCall $call,
        public readonly string $reason = 'ended'
    ) {
    }

    public function broadcastOn(): PresenceChannel
    {
        \Log::info('CallEnded event');
        return new PresenceChannel("call.{$this->call->uid}");
    }

    public function broadcastAs(): string
    {
        return 'call.ended';
    }

    public function broadcastWith(): array
    {
        return ['uid' => $this->call->uid, 'reason' => $this->reason, 'duration_seconds' => $this->call->duration_seconds, 'ended_at' => $this->call->ended_at?->toIso8601String()];
    }
}
