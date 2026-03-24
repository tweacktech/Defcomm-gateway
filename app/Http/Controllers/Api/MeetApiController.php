<?php
// ═══════════════════════════════════════════════════════════════════════════════
// app/Http/Controllers/Api/MeetApiController.php
// REST API for third-party SDK consumers (stateless, token auth)
// ═══════════════════════════════════════════════════════════════════════════════

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MeetRoom;
use App\Traits\ApiResponds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class MeetApiController extends Controller
{
    use ApiResponds;

    /**
     * POST /api/meet/rooms
     * Create a room from the SDK — caller authenticates via Sanctum API token.
     *
     * @OA\Post(
     *     path="/api/meet/rooms",
     *     summary="Create a meet room",
     *     tags={"Meet SDK"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=false,
     *         @OA\JsonContent(
     *             @OA\Property(property="name",               type="string",  example="Weekly Standup"),
     *             @OA\Property(property="password",           type="string",  example="secret123"),
     *             @OA\Property(property="max_participants",   type="integer", example=20),
     *             @OA\Property(property="video_enabled",      type="boolean", example=true),
     *             @OA\Property(property="audio_enabled",      type="boolean", example=true),
     *             @OA\Property(property="waiting_room",       type="boolean", example=false),
     *             @OA\Property(property="allowed_hosts",      type="array",   @OA\Items(type="string"), example={"https://myapp.com"}),
     *             @OA\Property(property="webhook_url",        type="string",  example="https://myapp.com/webhooks/meet"),
     *             @OA\Property(property="webhook_events",     type="array",   @OA\Items(type="string"))
     *         )
     *     ),
     *     @OA\Response(response=201, description="Room created", @OA\JsonContent(ref="#/components/schemas/CreatedResponse")),
     *     @OA\Response(response=401, description="Unauthenticated", @OA\JsonContent(ref="#/components/schemas/UnauthorizedResponse")),
     *     @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/ValidationErrorResponse"))
     * )
     */
    public function createRoom(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'             => ['nullable', 'string', 'max:120'],
            'password'         => ['nullable', 'string', 'min:4'],
            'max_participants' => ['nullable', 'integer', 'min:2', 'max:500'],
            'video_enabled'    => ['boolean'],
            'audio_enabled'    => ['boolean'],
            'waiting_room'     => ['boolean'],
            'allowed_hosts'    => ['nullable', 'array'],
            'allowed_hosts.*'  => ['url'],
            'webhook_url'      => ['nullable', 'url'],
            'webhook_events'   => ['nullable', 'array'],
        ]);

        $room = MeetRoom::create([
            ...$validated,
            'owner_id' => $request->user()->id,
            'app_key'  => $request->user()->currentAccessToken()?->name ?? 'api',
            'password' => isset($validated['password'])
                ? Hash::make($validated['password'])
                : null,
            'status'     => 'scheduled',
        ]);

        return $this->created([
            'room'       => $this->sdkRoomResource($room),
            'join_token' => $room->joinToken($request->user()->id, $request->user()->name),
            'embed_url'  => route('meet.embed', $room->uid),
        ], 'Room created.');
    }

    /**
     * GET /api/meet/rooms/{uid}
     *
     * @OA\Get(
     *     path="/api/meet/rooms/{uid}",
     *     summary="Get room info",
     *     tags={"Meet SDK"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="uid", in="path", required=true, @OA\Schema(type="string")),
     *     @OA\Response(response=200, description="Room details", @OA\JsonContent(ref="#/components/schemas/SuccessResponse")),
     *     @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/NotFoundResponse"))
     * )
     */
    public function getRoom(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)
            ->where('owner_id', $request->user()->id)
            ->withCount('activeParticipants')
            ->firstOrFail();

        return $this->ok($this->sdkRoomResource($room));
    }

    /**
     * GET /api/meet/rooms
     * List rooms for the authenticated SDK user.
     *
     * @OA\Get(
     *     path="/api/meet/rooms",
     *     summary="List rooms",
     *     tags={"Meet SDK"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="status", in="query", required=false, @OA\Schema(type="string", enum={"scheduled","active","ended"})),
     *     @OA\Response(response=200, description="Rooms listed", @OA\JsonContent(ref="#/components/schemas/PaginatedResponse"))
     * )
     */
    public function listRooms(Request $request): JsonResponse
    {
        $rooms = MeetRoom::where('owner_id', $request->user()->id)
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->withCount('activeParticipants')
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return $this->paginated(
            $rooms,
            fn ($r) => $this->sdkRoomResource($r),
        );
    }

    /**
     * DELETE /api/meet/rooms/{uid}
     * End a room via API.
     *
     * @OA\Delete(
     *     path="/api/meet/rooms/{uid}",
     *     summary="End a room",
     *     tags={"Meet SDK"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="uid", in="path", required=true, @OA\Schema(type="string")),
     *     @OA\Response(response=204, description="Room ended"),
     *     @OA\Response(response=403, description="Forbidden", @OA\JsonContent(ref="#/components/schemas/ForbiddenResponse"))
     * )
     */
    public function endRoom(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)
            ->where('owner_id', $request->user()->id)
            ->firstOrFail();

        $room->end();

        return $this->noContent();
    }

    /**
     * POST /api/meet/rooms/{uid}/token
     * Issue a join token for a guest participant.
     * The SDK consumer calls this from their backend to safely issue tokens.
     *
     * @OA\Post(
     *     path="/api/meet/rooms/{uid}/token",
     *     summary="Issue a join token for a participant",
     *     tags={"Meet SDK"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="uid", in="path", required=true, @OA\Schema(type="string")),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"display_name"},
     *             @OA\Property(property="display_name", type="string", example="Alice"),
     *             @OA\Property(property="user_id",      type="integer", nullable=true, example=42),
     *             @OA\Property(property="role",         type="string",  enum={"host","co-host","participant","viewer"})
     *         )
     *     ),
     *     @OA\Response(response=200, description="Token issued", @OA\JsonContent(ref="#/components/schemas/SuccessResponse"))
     * )
     */
    public function issueToken(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)
            ->where('owner_id', $request->user()->id)
            ->firstOrFail();

        $validated = $request->validate([
            'display_name' => ['required', 'string', 'max:80'],
            'user_id'      => ['nullable', 'integer'],
            'role'         => ['nullable', 'in:host,co-host,participant,viewer'],
        ]);

        return $this->ok([
            'token'    => $room->joinToken($validated['user_id'] ?? null, $validated['display_name']),
            'join_url' => route('meet.room', $room->uid),
            'embed_url' => route('meet.embed', $room->uid),
        ], 'Token issued. Embed the join_url or embed_url in your app.');
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private function sdkRoomResource(MeetRoom $room): array
    {
        return [
            'uid'                  => $room->uid,
            'name'                 => $room->name,
            'status'               => $room->status,
            'has_password'         => $room->hasPassword(),
            'max_participants'     => $room->max_participants,
            'active_participants'  => $room->active_participants_count ?? 0,
            'video_enabled'        => $room->video_enabled,
            'audio_enabled'        => $room->audio_enabled,
            'screen_share_enabled' => $room->screen_share_enabled,
            'recording_enabled'    => $room->recording_enabled,
            'waiting_room'         => $room->waiting_room,
            'allowed_hosts'        => $room->allowed_hosts,
            'webhook_url'          => $room->webhook_url,
            'started_at'           => $room->started_at?->toIso8601String(),
            'ended_at'             => $room->ended_at?->toIso8601String(),
            'join_url'             => route('meet.room', $room->uid),
            'embed_url'            => route('meet.embed', $room->uid),
        ];
    }
}
