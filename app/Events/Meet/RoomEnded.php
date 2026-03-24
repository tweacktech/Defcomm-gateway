<?php

namespace App\Events\Meet;

use App\Models\MeetParticipant;
use App\Models\MeetRoom;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Facades\Log;

class RoomEnded implements ShouldBroadcast
{
    public function __construct(public readonly MeetRoom $room) {}

    public function broadcastOn(): PresenceChannel
    {
        return new PresenceChannel("meet.{$this->room->uid}");
    }

    public function broadcastAs(): string { return 'meet.room-ended'; }

    public function broadcastWith(): array {
        Log::info('RoomEnded event');
         return ['uid' => $this->room->uid]; }
}
