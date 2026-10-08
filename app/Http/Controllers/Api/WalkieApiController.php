<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WalkieChannel;
use App\Models\WalkieRecording;
use App\Models\WalkieSubscriber;
use App\Services\FirebaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class WalkieApiController extends Controller
{
    public function __construct(protected FirebaseService $fcm) {}

    public function createChannel(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'frequency' => 'nullable|string|max:60',
            'description' => 'nullable|string|max:500',
        ]);

        $user = $request->user();
        $channel = WalkieChannel::create([
            ...$data,
            'user_id' => $user->id,
            'organization_id' => $user->organization_id,
            'status' => 'active',
        ]);

        WalkieSubscriber::create([
            'channel_id' => $channel->id,
            'user_id' => $user->id,
            'user_type' => 'creator',
            'status' => 'active',
        ]);

        return $this->ok([
            'id' => $channel->id,
            'name' => $channel->name,
            'frequency' => $channel->frequency,
            'description' => $channel->description,
        ], 'Channel created.', 201);
    }

    public function updateChannel(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => 'required|integer|exists:walkie_channels,id',
            'name' => 'nullable|string|max:120',
            'frequency' => 'nullable|string|max:60',
            'description' => 'nullable|string|max:500',
        ]);

        $channel = WalkieChannel::query()
            ->where('id', $data['id'])
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $channel->update(collect($data)->except('id')->filter(fn ($v) => $v !== null)->all());

        return $this->ok([
            'id' => $channel->id,
            'name' => $channel->name,
            'frequency' => $channel->frequency,
            'description' => $channel->description,
        ], 'Channel updated.');
    }

    public function deleteChannel(Request $request, int $id): JsonResponse
    {
        WalkieChannel::query()
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail()
            ->delete();

        return $this->ok(null, 'Channel deleted.');
    }

    public function listChannels(Request $request): JsonResponse
    {
        $subs = WalkieSubscriber::query()
            ->with('channel')
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->get()
            ->map(fn (WalkieSubscriber $s) => [
                'sub_id' => $s->id,
                'channel_id' => $s->channel_id,
                'name' => $s->channel?->name,
                'frequency' => $s->channel?->frequency,
                'description' => $s->channel?->description,
                'status' => $s->status,
            ]);

        return $this->ok($subs);
    }

    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'channel_id' => 'required|integer|exists:walkie_channels,id',
            'users' => 'required|array|min:1',
            'users.*' => 'integer|exists:users,id',
        ]);

        $channel = WalkieChannel::query()
            ->where('id', $data['channel_id'])
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        foreach ($data['users'] as $userId) {
            WalkieSubscriber::firstOrCreate(
                ['channel_id' => $channel->id, 'user_id' => $userId],
                ['user_type' => 'user', 'status' => 'pending'],
            );
        }

        return $this->ok(null, 'Invites sent.');
    }

    public function listInvites(Request $request, string $status): JsonResponse
    {
        $rows = WalkieSubscriber::query()
            ->with(['channel', 'user'])
            ->where('user_id', $request->user()->id)
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->get()
            ->map(fn (WalkieSubscriber $s) => [
                'sub_id' => $s->id,
                'channel_id' => $s->channel_id,
                'name' => $s->channel?->name,
                'frequency' => $s->channel?->frequency,
                'description' => $s->channel?->description,
                'userType' => $s->user_type,
                'user_id' => $s->user_id,
                'user_name' => $s->user?->name,
                'status' => $s->status,
            ]);

        return $this->ok($rows);
    }

    public function inviteStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sub_id' => 'required|integer|exists:walkie_subscribers,id',
            'status' => 'required|in:active,reject,block',
        ]);

        $sub = WalkieSubscriber::query()
            ->where('id', $data['sub_id'])
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $sub->update(['status' => $data['status']]);

        return $this->ok(null, 'Invite status updated.');
    }

    public function broadcast(Request $request): JsonResponse
    {
        $data = $request->validate([
            'channel' => 'required|integer|exists:walkie_channels,id',
            'record' => 'required|file|max:20480',
            'record_text' => 'nullable|string',
            'source_language' => 'nullable|string|max:20',
        ]);

        $user = $request->user();
        $sub = WalkieSubscriber::query()
            ->where('channel_id', $data['channel'])
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->firstOrFail();

        $file = $request->file('record');
        $path = $file->store('walkie/'.$data['channel'], 'public');

        $recording = WalkieRecording::create([
            'channel_id' => $data['channel'],
            'user_id' => $user->id,
            'subscriber_id' => $sub->id,
            'path' => $path,
            'record' => Storage::disk('public')->url($path),
            'record_text' => $data['record_text'] ?? null,
            'file_size' => $file->getSize(),
            'file_ext' => $file->getClientOriginalExtension(),
            'source_language' => $data['source_language'] ?? null,
        ]);

        $channel = $recording->channel()->first();
        $payload = [
            'state' => 'broadcast',
            'sender' => ['id' => $user->id, 'name' => $user->name],
            'receiver' => ['channel_id' => $channel?->id],
            'mss_chat' => [
                'recording_id' => $recording->id,
                'channel_id' => $channel?->id,
                'channel_name' => $channel?->name,
                'user_id' => $user->id,
                'user_name' => $user->name,
                'record' => $recording->record,
                'record_text' => $recording->record_text,
                'created_at' => $recording->created_at?->toIso8601String(),
            ],
        ];

        WalkieSubscriber::query()
            ->with('user')
            ->where('channel_id', $data['channel'])
            ->where('status', 'active')
            ->where('user_id', '!=', $user->id)
            ->get()
            ->each(function (WalkieSubscriber $s) use ($payload) {
                if ($s->user) {
                    $this->fcm->sendToUser($s->user, 'Walkie broadcast', $payload['mss_chat']['channel_name'] ?? 'New broadcast', $payload);
                }
            });

        return $this->ok($payload, 'Broadcast sent.', 201);
    }

    public function broadcastList(Request $request, int $channelId): JsonResponse
    {
        $this->assertActiveSubscriber($request, $channelId);

        $rows = WalkieRecording::query()
            ->with(['user', 'channel'])
            ->where('channel_id', $channelId)
            ->latest()
            ->get()
            ->map(fn (WalkieRecording $r) => [
                'recording_id' => $r->id,
                'channel_id' => $r->channel_id,
                'channel_name' => $r->channel?->name,
                'user_id' => $r->user_id,
                'user_name' => $r->user?->name,
                'source_language' => $r->source_language,
                'record' => $r->record,
                'record_text' => $r->record_text,
                'created_at' => $r->created_at?->toIso8601String(),
            ]);

        return $this->ok($rows);
    }

    public function broadcastDelete(Request $request, int $recordingId): JsonResponse
    {
        $recording = WalkieRecording::query()->findOrFail($recordingId);
        abort_unless((int) $recording->user_id === (int) $request->user()->id, 403);
        $recording->delete();

        return $this->ok(null, 'Recording deleted.');
    }

    public function subscriberJoin(Request $request): JsonResponse
    {
        $data = $request->validate(['channel_id' => 'required|integer|exists:walkie_channels,id']);
        WalkieSubscriber::updateOrCreate(
            ['channel_id' => $data['channel_id'], 'user_id' => $request->user()->id],
            ['status' => 'active', 'user_type' => 'user'],
        );

        return $this->ok(null, 'Joined channel.');
    }

    public function subscriberLeave(Request $request): JsonResponse
    {
        $data = $request->validate(['channel_id' => 'required|integer|exists:walkie_channels,id']);
        WalkieSubscriber::query()
            ->where('channel_id', $data['channel_id'])
            ->where('user_id', $request->user()->id)
            ->update(['status' => 'block']);

        return $this->ok(null, 'Left channel.');
    }

    public function subscriberActive(Request $request, int $channelId): JsonResponse
    {
        $this->assertActiveSubscriber($request, $channelId);

        $rows = WalkieSubscriber::query()
            ->with('user')
            ->where('channel_id', $channelId)
            ->where('status', 'active')
            ->get()
            ->map(fn (WalkieSubscriber $s) => [
                'channel' => $s->channel_id,
                'subscriber_id' => $s->id,
                'user_id' => $s->user_id,
                'user_name' => $s->user?->name,
            ]);

        return $this->ok($rows);
    }

    protected function assertActiveSubscriber(Request $request, int $channelId): void
    {
        $ok = WalkieSubscriber::query()
            ->where('channel_id', $channelId)
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->exists();

        abort_unless($ok, 403, 'Not an active subscriber of this channel.');
    }

    protected function ok(mixed $data, string $message = 'OK', int $status = 200): JsonResponse
    {
        return response()->json([
            'status' => (string) $status,
            'message' => $message,
            'data' => $data,
        ], $status === 201 ? 201 : 200);
    }
}
