<?php

namespace App\Events;

use App\Models\ChatMessage;
use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class ChatMessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(
        public readonly ChatMessage $message,
        public readonly User $sender,
        public readonly User $recipient,
        public readonly string $plainText,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("chat.{$this->recipient->id}"),
            new PrivateChannel("chat.{$this->sender->id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'chat.message-sent';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'user_id' => $this->sender->id,
            'user_to' => $this->recipient->id,
            'group_to' => $this->message->group_to,
            'mss_type' => $this->message->mss_type,
            'message' => $this->plainText,
            'sender' => [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'email' => $this->sender->email,
            ],
            'created_at' => $this->message->created_at?->toIso8601String(),
        ];
    }
}
