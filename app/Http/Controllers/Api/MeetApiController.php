<?php

namespace App\Http\Controllers\Api;

use App\Events\Meet\ParticipantJoined;
use App\Events\Meet\ParticipantKicked;
use App\Events\Meet\RoomEnded;
use App\Http\Controllers\Controller;
use App\Models\MeetParticipant;
use App\Models\MeetRecording;
use App\Models\MeetRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * SDK REST API — all routes under /api/meet
 * Auth: Bearer Sanctum token (server-to-server only)
 */
class MeetApiController extends Controller
{
    // =========================================================================
    // ROOMS
    // =========================================================================

    public function createRoom(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'password' => ['nullable', 'string', 'min:4'],
            'max_participants' => ['nullable', 'integer', 'min:2', 'max:500'],
            'video_enabled' => ['boolean'],
            'audio_enabled' => ['boolean'],
            'screen_share_enabled' => ['boolean'],
            'recording_enabled' => ['boolean'],
            'waiting_room' => ['boolean'],
            'webhook_url' => ['nullable', 'url'],
            'webhook_events' => ['nullable', 'array'],
            'webhook_events.*' => ['string'],
        ]);

        $room = MeetRoom::create([
            ...$v,
            'owner_id' => $request->user()->id,
            'password' => isset($v['password']) ? Hash::make($v['password']) : null,
            'status' => 'active',
            'started_at' => now(),
        ]);

        // Issue a host join token immediately
        $hostToken = $this->makeJoinToken($room, [
            'display_name' => $request->user()->name,
            'user_id' => $request->user()->id,
            'role' => 'host',
        ]);

        $this->webhook($room, 'room.started', ['uid' => $room->uid, 'started_at' => now()->toIso8601String()]);

        return response()->json([
            'status' => 'success',
            'message' => 'Room created.',
            'data' => [
                'room' => $this->roomResource($room),
                'join_token' => $hostToken,
                'join_url' => route('meet.room', $room->uid),
                'embed_url' => url("/embed/meet/{$room->uid}"),
            ],
        ], 201);
    }

    public function listRooms(Request $request): JsonResponse
    {
        $rooms = MeetRoom::where('owner_id', $request->user()->id)
            ->when($request->input('status'), fn($q, $s) => $q->where('status', $s))
            ->withCount('activeParticipants')
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json([
            'status' => 'success',
            'data' => [
                'rooms' => $rooms->map(fn($r) => $this->roomResource($r)),
                'meta' => [
                    'total' => $rooms->total(),
                    'per_page' => $rooms->perPage(),
                    'current_page' => $rooms->currentPage(),
                    'last_page' => $rooms->lastPage(),
                ],
            ],
        ]);
    }

    public function getRoom(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)
            ->where('owner_id', $request->user()->id)
            ->withCount('activeParticipants')
            ->firstOrFail();

        $participants = $room->activeParticipants()->get()->map(fn($p) => $this->participantResource($p));

        return response()->json([
            'status' => 'success',
            'data' => [
                'room' => $this->roomResource($room),
                'participants' => $participants,
            ],
        ]);
    }

    public function updateRoom(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->where('owner_id', $request->user()->id)->firstOrFail();

        $v = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'max_participants' => ['sometimes', 'integer', 'min:2', 'max:500'],
            'waiting_room' => ['sometimes', 'boolean'],
            'recording_enabled' => ['sometimes', 'boolean'],
            'webhook_url' => ['sometimes', 'nullable', 'url'],
            'webhook_events' => ['sometimes', 'nullable', 'array'],
        ]);

        $room->update($v);

        return response()->json(['status' => 'success', 'data' => $this->roomResource($room->fresh())]);
    }

    public function endRoom(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->where('owner_id', $request->user()->id)->firstOrFail();
        $room->end();
        broadcast(new RoomEnded($room));
        $this->webhook($room, 'room.ended', ['uid' => $room->uid, 'ended_at' => $room->ended_at?->toIso8601String()]);
        return response()->json(null, 204);
    }

    // =========================================================================
    // JOIN TOKENS
    // =========================================================================

    /**
     * POST /api/meet/rooms/{uid}/token
     * Issue a short-lived join token for a participant.
     * Call from your backend; pass token to your frontend.
     */
    public function issueToken(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->where('owner_id', $request->user()->id)->firstOrFail();

        if ($room->isEnded()) {
            return response()->json(['status' => 'error', 'message' => 'Room has ended.'], 410);
        }

        $v = $request->validate([
            'display_name' => ['required', 'string', 'max:80'],
            'user_id' => ['nullable'],
            'role' => ['nullable', 'in:host,co-host,participant,viewer'],
        ]);

        $token = $this->makeJoinToken($room, $v);

        return response()->json([
            'status' => 'success',
            'data' => [
                'token' => $token,
                'join_url' => route('meet.room', $room->uid) . '?token=' . urlencode($token),
                'embed_url' => url("/embed/meet/{$room->uid}") . '?token=' . urlencode($token),
                'expires_in' => '2 hours',
            ],
        ]);
    }

    // =========================================================================
    // PARTICIPANTS
    // =========================================================================

    public function listParticipants(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->where('owner_id', $request->user()->id)->firstOrFail();

        $participants = $room->participants()
            ->when($request->boolean('active_only', true), fn($q) => $q->whereNull('left_at'))
            ->orderBy('joined_at')
            ->get()
            ->map(fn($p) => $this->participantResource($p));

        return response()->json(['status' => 'success', 'data' => ['participants' => $participants]]);
    }

    /**
     * DELETE /api/meet/rooms/{uid}/participants/{peerId}
     * Kick a participant.
     */
    public function kickParticipant(Request $request, string $uid, string $peerId): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->where('owner_id', $request->user()->id)->firstOrFail();
        $p = MeetParticipant::where('room_id', $room->id)->where('peer_id', $peerId)->whereNull('left_at')->firstOrFail();
        $p->leave();
        broadcast(new ParticipantKicked($room->uid, $peerId));
        $this->webhook($room, 'participant.kicked', ['peer_id' => $peerId, 'display_name' => $p->display_name]);
        return response()->json(null, 204);
    }

    /**
     * POST /api/meet/rooms/{uid}/participants/{peerId}/admit
     * Admit a participant from the waiting room.
     */
    public function admitParticipant(Request $request, string $uid, string $peerId): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->where('owner_id', $request->user()->id)->firstOrFail();
        $p = MeetParticipant::where('room_id', $room->id)->where('peer_id', $peerId)->where('is_admitted', false)->firstOrFail();
        $p->update(['is_admitted' => true]);
        broadcast(new ParticipantJoined($room, $p));   // fires to ALL including the admitted participant
        return response()->json(['status' => 'success', 'data' => ['status' => 'admitted']]);
    }

    // =========================================================================
    // RECORDINGS
    // =========================================================================

    public function listRecordings(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->where('owner_id', $request->user()->id)->firstOrFail();
        $recs = $room->recordings()->orderBy('started_at', 'desc')->get()->map(fn($r) => $this->recordingResource($r));
        return response()->json(['status' => 'success', 'data' => ['recordings' => $recs]]);
    }

    public function getRecording(Request $request, string $uid, int $id): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->where('owner_id', $request->user()->id)->firstOrFail();
        $rec = MeetRecording::where('id', $id)->where('room_id', $room->id)->firstOrFail();
        return response()->json(['status' => 'success', 'data' => $this->recordingResource($rec)]);
    }

    public function deleteRecording(Request $request, string $uid, int $id): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->where('owner_id', $request->user()->id)->firstOrFail();
        $rec = MeetRecording::where('id', $id)->where('room_id', $room->id)->firstOrFail();
        if ($rec->path)
            Storage::disk($rec->disk ?? 'local')->delete($rec->path);
        $rec->delete();
        return response()->json(null, 204);
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private function makeJoinToken(MeetRoom $room, array $attrs): string
    {
        $payload = base64_encode(json_encode([
            'room_uid' => $room->uid,
            'display_name' => $attrs['display_name'],
            'user_id' => $attrs['user_id'] ?? null,
            'role' => $attrs['role'] ?? 'participant',
            'expires_at' => now()->addHours(2)->timestamp,
        ]));
        $sig = hash_hmac('sha256', $payload, config('app.key'));
        return $payload . '.' . $sig;
    }

    private function webhook(MeetRoom $room, string $event, array $payload = []): void
    {
        if (!$room->webhook_url)
            return;
        $events = $room->webhook_events ?? [];
        if (!empty($events) && !in_array($event, $events))
            return;

        $ts = now()->timestamp;
        $sig = hash_hmac('sha256', $room->uid . $ts, config('app.key'));

        try {
            Http::timeout(5)->withHeaders(['X-Defcomm-Signature' => $sig])->post($room->webhook_url, [
                'event' => $event,
                'room_uid' => $room->uid,
                'payload' => $payload,
                'timestamp' => $ts,
            ]);
        } catch (\Throwable) { /* best-effort */
        }
    }

    private function roomResource(MeetRoom $r): array
    {
        return [
            'uid' => $r->uid,
            'name' => $r->name,
            'status' => $r->status,
            'has_password' => $r->hasPassword(),
            'max_participants' => $r->max_participants,
            'active_participants' => $r->active_participants_count ?? 0,
            'video_enabled' => $r->video_enabled,
            'audio_enabled' => $r->audio_enabled,
            'screen_share_enabled' => $r->screen_share_enabled,
            'recording_enabled' => $r->recording_enabled,
            'waiting_room' => $r->waiting_room,
            'webhook_url' => $r->webhook_url,
            'webhook_events' => $r->webhook_events,
            'started_at' => $r->started_at?->toIso8601String(),
            'ended_at' => $r->ended_at?->toIso8601String(),
            'join_url' => route('meet.room', $r->uid),
            'embed_url' => url("/embed/meet/{$r->uid}"),
        ];
    }

    private function participantResource(MeetParticipant $p): array
    {
        return [
            'peer_id' => $p->peer_id,
            'display_name' => $p->display_name,
            'role' => $p->role,
            'is_admitted' => $p->is_admitted,
            'video_on' => $p->video_on,
            'audio_on' => $p->audio_on,
            'hand_raised' => $p->hand_raised,
            'joined_at' => $p->joined_at->toIso8601String(),
            'left_at' => $p->left_at?->toIso8601String(),
            'duration_seconds' => $p->duration_seconds,
        ];
    }

    private function recordingResource(MeetRecording $r): array
    {
        return [
            'id' => $r->id,
            'status' => $r->status,
            'size_bytes' => $r->size,
            'size_human' => $r->formattedSize(),
            'duration_seconds' => $r->duration_seconds,
            'duration_human' => $r->formattedDuration(),
            'started_at' => $r->started_at->toIso8601String(),
            'ended_at' => $r->ended_at?->toIso8601String(),
            'download_url' => $r->isReady() ? $r->downloadUrl() : null,
        ];
    }
}