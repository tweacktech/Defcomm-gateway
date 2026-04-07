<?php

namespace App\Events\AudioCall;

use App\Models\AudioCall;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CallPriorityChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly AudioCall $call,
        public readonly string $oldPriority
    ) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("call.{$this->call->uid}");
    }

    public function broadcastAs(): string
    {
        return 'call.priority-changed';
    }

    public function broadcastWith(): array
    {
        return ['uid'=>$this->call->uid,'priority'=>$this->call->priority,'priority_label'=>$this->call->priorityLabel(),'priority_color'=>$this->call->priorityColor(),'old_priority'=>$this->oldPriority,'priority_note'=>$this->call->priority_note];
    }
}
