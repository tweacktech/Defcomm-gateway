<?php

namespace App\Events\Meet;

use App\Models\MeetParticipant;
use App\Models\MeetRoom;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Fired when the host explicitly admits a participant from the waiting room.
 *
 * Unlike ParticipantJoined (which fires for any normal join), this event is
 * targeted: it carries an `admitted_peer_id` so the waiting participant can
 * self-identify and proceed into the live channel without relying on a
 * ParticipantJoined event that could also fire for other people joining.
 *
 * Broadcast channel: presence-meet.{roomUid}
 * Frontend event name: .meet.participant-admitted
 */
class ParticipantAdmitted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $roomUid;
    public string $admittedPeerId;
    public string $displayName;
    public string $role;
    public bool $videoOn;
    public bool $audioOn;

    public function __construct(MeetRoom $room, MeetParticipant $participant)
    {
        $this->roomUid = $room->uid;
        $this->admittedPeerId = $participant->peer_id;
        $this->displayName = $participant->display_name;
        $this->role = $participant->role;
        $this->videoOn = (bool) $participant->video_on;
        $this->audioOn = (bool) $participant->audio_on;
    }

    /**
     * Broadcast on the same presence channel the room uses.
     * This means both the waiting participant and existing peers receive it.
     */
    public function broadcastOn(): array
    {
        \Log::info('ParticipantAdmitted event');
        return [
            new PresenceChannel("meet.{$this->roomUid}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'meet.participant-admitted';
    }

    public function broadcastWith(): array
    {
        return [
            'admitted_peer_id' => $this->admittedPeerId,
            'display_name' => $this->displayName,
            'role' => $this->role,
            'video_on' => $this->videoOn,
            'audio_on' => $this->audioOn,
        ];
    }
}
