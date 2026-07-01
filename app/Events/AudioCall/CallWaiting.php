<?php

namespace App\Events\AudioCall;

use App\Models\AudioCall;
use App\Models\AudioCallParticipant;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallWaiting implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly AudioCall $call,
        public readonly AudioCallParticipant $participant
    ) {
    }

    public function broadcastOn(): PresenceChannel
    {
        \Log::info('CallWaiting event');
        return new PresenceChannel("call.{$this->call->uid}");
    }

    public function broadcastAs(): string
    {
        return 'call.participant-waiting';
    }

    public function broadcastWith(): array
    {
        return ['peer_id' => $this->participant->peer_id, 'display_name' => $this->participant->display_name, 'role' => $this->participant->role];
    }
}
