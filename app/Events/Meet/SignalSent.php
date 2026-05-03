<?php

namespace App\Events\Meet;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Facades\Log;

class SignalSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public readonly string $roomUid,
        public readonly string $from,
        public readonly string $to,
        public readonly string $type,     // offer | answer | ice-candidate
        public readonly mixed $payload,
    ) {
    }

    // public function broadcastOn(): Channel
    // {
    //     return new PresenceChannel("meet.{$this->roomUid}");
    // }

    /**
     * FIXED: Changed from PresenceChannel (broadcast to all)
     * to PrivateChannel (only target peer receives)
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("meet.signal.{$this->to}"),
        ];
    }


    public function broadcastAs(): string
    {
        return 'meet.signal';
    }

    public function broadcastWith(): array
    {
        Log::info('SignalSent event');
        return [
            'from' => $this->from,
            'to' => $this->to,
            'type' => $this->type,
            'payload' => $this->payload,
        ];
    }
}
