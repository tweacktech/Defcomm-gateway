<?php

namespace App\Events\AudioCall;

use App\Models\AudioCall;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallInitiated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly AudioCall $call
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("call.{$this->call->uid}");
    }

    public function broadcastAs(): string
    {
        return 'call.initiated';
    }

    public function broadcastWith(): array
    {
        return ['uid'=>$this->call->uid,'title'=>$this->call->title,'initiator'=>$this->call->initiator->name,
        'initiator_id'=>$this->call->initiator_id,'priority'=>$this->call->priority,'priority_label'=>$this->call->priorityLabel(),
        'priority_color'=>$this->call->priorityColor(),
        'priority_note'=>$this->call->priority_note,'mode'=>$this->call->mode,'callee_id'=>$this->call->callee_id];
    }
}
