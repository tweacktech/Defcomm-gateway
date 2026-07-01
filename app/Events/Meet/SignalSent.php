<?php

namespace App\Events\Meet;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * WebRTC signaling event — sent point-to-point via a private channel.
 *
 * Broadcast on: private-signals.{to}
 *
 * This targets ONLY the recipient peer by routing through their private
 * channel instead of broadcasting to the whole presence channel. This is
 * critical for correct WebRTC signalling — each peer must only receive
 * the offer/answer/ice-candidate addressed to them.
 *
 * The React client subscribes to `echo.private('signals.{myPeerId}')`
 * and listens for the 'Meet\\SignalSent' event.
 */
class SignalSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $roomUid,
        public readonly string $from,
        public readonly string $to,
        public readonly string $type,      // 'offer' | 'answer' | 'ice-candidate'
        public readonly mixed $payload,   // RTCSessionDescriptionInit | RTCIceCandidateInit
    ) {
    }

    /**
     * Broadcast on the recipient's private channel only.
     * The channel name matches: echo.private('signals.{peerId}')
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("signals.{$this->to}"),
        ];
    }

    /**
     * Event name as seen by the client listener:
     *   .listen('Meet\\SignalSent', handler)
     */
    public function broadcastAs(): string
    {
        return 'Meet\\SignalSent';
    }

    public function broadcastWith(): array
    {
        return [
            'room_uid' => $this->roomUid,
            'from' => $this->from,
            'to' => $this->to,
            'type' => $this->type,
            'payload' => $this->payload,
        ];
    }
}
