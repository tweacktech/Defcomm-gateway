<?php

namespace App\Events\AudioCall;

use App\Models\AudioCall;
use App\Models\AudioCallParticipant;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ParticipantJoinedCall implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly AudioCall $call,
        public readonly AudioCallParticipant $participant
    ) {
    }

    public function broadcastOn(): PresenceChannel
    {
        \Log::info('ParticipantJoinedCall event');
        return new PresenceChannel("call.{$this->call->uid}");
    }

    public function broadcastAs(): string
    {
        return 'call.participant-joined';
    }

    public function broadcastWith(): array
    {
        return ['peer_id' => $this->participant->peer_id, 'display_name' => $this->participant->display_name, 'role' => $this->participant->role, 'is_admitted' => $this->participant->is_admitted, 'audio_on' => $this->participant->audio_on, 'joined_at' => $this->participant->joined_at?->toIso8601String()];
    }
}
