<?php

namespace App\Services;

use App\Events\ChatMessageSent;
use App\Models\ChatLastLog;
use App\Models\ChatMessage;
use App\Models\User;

class PushChatService
{
    /**
     * Push a direct message into the chat system on behalf of a user.
     */
    public function pushDirectMessage(User $sender, User $recipient, string $message, string $mssType = 'text'): ChatMessage
    {
        if ($sender->id === $recipient->id) {
            throw new \InvalidArgumentException('Cannot send a message to yourself.');
        }

        if ((int) $sender->organization_id !== (int) $recipient->organization_id) {
            throw new \InvalidArgumentException('Sender and recipient must belong to the same organization.');
        }

        $threadId = $this->resolveThreadId($sender->id, $recipient->id);

        $chatMessage = ChatMessage::create([
            'user_id' => $sender->id,
            'user_to' => $recipient->id,
            'group_to' => $threadId,
            'reference_chat' => null,
            'user_group' => 'user',
            'is_file' => 'no',
            'mss_type' => $mssType,
            'file_type' => 'other',
            'is_read' => 'no',
            'is_important' => 'no',
            'is_forward' => 'no',
            'is_star' => 'no',
            'view_once' => 'no',
            'expire_time' => null,
            'message' => encrypt($message),
        ]);

        ChatLastLog::updateOrCreate([
            'user_id' => $sender->id,
            'user_to' => $recipient->id,
            'group_to' => $threadId,
        ], [
            'chat_id' => $chatMessage->id,
            'user_group' => 'user',
            'is_file' => 'no',
        ]);

        ChatLastLog::updateOrCreate([
            'user_id' => $recipient->id,
            'user_to' => $sender->id,
            'group_to' => $threadId,
        ], [
            'chat_id' => $chatMessage->id,
            'user_group' => 'user',
            'is_file' => 'no',
        ]);

        broadcast(new ChatMessageSent($chatMessage, $sender, $recipient, $message));

        return $chatMessage;
    }

    /**
     * Push a system/service notification message to a user.
     */
    public function pushSystemMessage(User $recipient, string $message, ?User $sender = null): ChatMessage
    {
        $sender ??= User::query()
            ->where('organization_id', $recipient->organization_id)
            ->where('role', 'admin')
            ->first();

        if (! $sender) {
            $sender = $recipient;
        }

        return $this->pushDirectMessage($sender, $recipient, $message, 'system');
    }

    private function resolveThreadId(int $userA, int $userB): string
    {
        $existing = ChatLastLog::query()
            ->where(function ($query) use ($userA, $userB) {
                $query->where(function ($q) use ($userA, $userB) {
                    $q->where('user_id', $userA)->where('user_to', $userB);
                })->orWhere(function ($q) use ($userA, $userB) {
                    $q->where('user_id', $userB)->where('user_to', $userA);
                });
            })
            ->where('user_group', 'user')
            ->value('group_to');

        return $existing ?? uniqid('chat_', true);
    }
}
