<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\User;
use App\Services\PushChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatApiController extends Controller
{
    public function __construct(
        private readonly PushChatService $pushChatService,
    ) {}

    /**
     * POST /api/chat/push
     * Push a message to another user in the same organization.
     */
    public function push(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recipient_id' => ['required', 'integer', 'exists:users,id'],
            'message' => ['required', 'string', 'max:10000'],
            'mss_type' => ['sometimes', 'string', 'in:text,system,notification'],
        ]);

        /** @var User $sender */
        $sender = $request->user();
        $recipient = User::findOrFail($validated['recipient_id']);

        try {
            $chatMessage = $this->pushChatService->pushDirectMessage(
                $sender,
                $recipient,
                $validated['message'],
                $validated['mss_type'] ?? 'text',
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Message pushed to chat.',
            'data' => $this->formatMessage($chatMessage, $validated['message']),
        ], 201);
    }

    /**
     * GET /api/chat/messages?recipient_id=
     * List messages between authenticated user and a recipient.
     */
    public function messages(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recipient_id' => ['required', 'integer', 'exists:users,id'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $recipientId = (int) $validated['recipient_id'];
        $limit = (int) ($validated['limit'] ?? 50);

        $messages = ChatMessage::query()
            ->where('user_group', 'user')
            ->where(function ($query) use ($user, $recipientId) {
                $query->where(function ($q) use ($user, $recipientId) {
                    $q->where('user_id', $user->id)->where('user_to', $recipientId);
                })->orWhere(function ($q) use ($user, $recipientId) {
                    $q->where('user_id', $recipientId)->where('user_to', $user->id);
                });
            })
            ->latest()
            ->limit($limit)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (ChatMessage $msg) => $this->formatMessage($msg));

        return response()->json(['data' => $messages]);
    }

    /**
     * GET /api/chat/conversations
     * List recent conversations for the authenticated user.
     */
    public function conversations(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $logs = \App\Models\ChatLastLog::query()
            ->with(['user', 'userTo', 'chat'])
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)
                    ->orWhere('user_to', $user->id);
            })
            ->where('user_group', 'user')
            ->latest()
            ->get()
            ->unique(fn ($log) => $log->user_id === $user->id ? $log->user_to : $log->user_id)
            ->values()
            ->map(function ($log) use ($user) {
                $otherUser = $log->user_id === $user->id ? $log->userTo : $log->user;

                return [
                    'thread_id' => $log->group_to,
                    'recipient' => $otherUser ? [
                        'id' => $otherUser->id,
                        'name' => $otherUser->name,
                        'email' => $otherUser->email,
                    ] : null,
                    'last_message' => $log->chat?->message ? decrypt($log->chat->message) : null,
                    'updated_at' => $log->updated_at?->toIso8601String(),
                ];
            });

        return response()->json(['data' => $logs]);
    }

    private function formatMessage(ChatMessage $message, ?string $plainText = null): array
    {
        $text = $plainText ?? ($message->message ? decrypt($message->message) : null);

        return [
            'id' => $message->id,
            'user_id' => $message->user_id,
            'user_to' => $message->user_to,
            'group_to' => $message->group_to,
            'mss_type' => $message->mss_type,
            'message' => $text,
            'is_read' => $message->is_read,
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }
}
