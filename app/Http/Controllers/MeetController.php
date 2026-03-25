<?php

namespace App\Http\Controllers;

use App\Events\Meet\ParticipantJoined;
use App\Events\Meet\ParticipantLeft;
use App\Events\Meet\ParticipantMediaUpdated;
use App\Events\Meet\RecordingStarted;
use App\Events\Meet\RecordingStopped;
use App\Events\Meet\RoomEnded;
use App\Events\Meet\SignalSent;
use App\Models\MeetParticipant;
use App\Models\MeetRecording;
use App\Models\MeetRoom;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class MeetController extends Controller
{
    use LogsActivity;

    // =========================================================================
    // PAGES
    // =========================================================================

    /**
     * GET /meet — authenticated lobby.
     */
    public function index(Request $request): Response
    {
        $userId = $request->user()->id;

        $rooms = MeetRoom::where('owner_id', $userId)
            ->withCount('activeParticipants')
            ->orderBy('created_at', 'desc')
            ->take(10)
            ->get()
            ->map(fn($r) => $this->roomResource($r));

        return Inertia::render('meet/meet-index', [
            'rooms' => $rooms,
        ]);
    }

    /**
     * GET /meet/{uid} — public route (auth optional).
     *
     * Flow decision tree:
     *   Guest (no auth) + not yet through guest form  → meet/guest
     *   Guest (no auth) + session admitted            → meet/room (guest mode)
     *   Auth + password needed                        → meet/password
     *   Auth + admitted                               → meet/room
     *   Room ended                                    → meet/ended
     */
    public function room(Request $request, string $uid): Response|RedirectResponse
    {

        $room = MeetRoom::where('uid', $uid)
            ->with(['owner:id,name'])
            ->withCount('activeParticipants')
            ->firstOrFail();

        // ── Room ended ────────────────────────────────────────────────────────
        if ($room->isEnded()) {
            return Inertia::render('meet/meet-ended', [
                'room' => $this->roomResource($room),
            ]);
        }

        // ── Unauthenticated guest ─────────────────────────────────────────────
        if (!$request->user()) {
            $guestSession = $request->session()->get("meet_guest_{$room->id}");

            if (!$guestSession) {
                // Not yet through guest form
                return Inertia::render('meet/meet-guest', [
                    'room' => $this->roomResource($room),
                ]);
            }

            // Guest admitted via session — render call room
            return $this->renderRoom($request, $room, isGuest: true);
        }

        // ── Authenticated user ────────────────────────────────────────────────
        if ($room->hasPassword() && !$request->session()->get("meet_admitted_{$room->id}")) {
            return Inertia::render('meet/meet-password', [
                'room' => $this->roomResource($room),
            ]);
        }
        return $this->renderRoom($request, $room, isGuest: false);
    }

    /**
     * Shared room render — produces the meet/room Inertia page.
     */
    private function renderRoom(Request $request, MeetRoom $room, bool $isGuest): Response
    {
        $peerId = (string) Str::uuid();
        $guestData = $request->session()->get("meet_guest_{$room->id}");
        $displayName = $isGuest
            ? ($guestData['name'] ?? 'Guest')
            : $request->user()->name;

        return Inertia::render('meet/meet-room', [
            'room' => $this->roomResource($room),
            'peer_id' => $peerId,
            'display_name' => $displayName,
            'is_owner' => !$isGuest && $room->owner_id === $request->user()?->id,
            'is_guest' => $isGuest,
            'reverb_key' => config('broadcasting.connections.reverb.key'),
            'reverb_host' => config('broadcasting.connections.reverb.options.host'),
            'reverb_port' => config('broadcasting.connections.reverb.options.port'),
            'stun_servers' => config('meet.stun_servers', [
                ['urls' => 'stun:stun.l.google.com:19302'],
                ['urls' => 'stun:stun1.l.google.com:19302'],
            ]),
        ]);
    }

    // =========================================================================
    // ROOM CRUD
    // =========================================================================

    /**
     * POST /meet/rooms — create room (auth required).
     */
    public function create(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'password' => ['nullable', 'string', 'min:4', 'max:64'],
            'max_participants' => ['nullable', 'integer', 'min:2', 'max:200'],
            'video_enabled' => ['boolean'],
            'audio_enabled' => ['boolean'],
            'screen_share_enabled' => ['boolean'],
            'recording_enabled' => ['boolean'],
            'waiting_room' => ['boolean'],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
        ]);

        $room = MeetRoom::create([
            ...$validated,
            'owner_id' => $request->user()->id,
            'password' => isset($validated['password'])
                ? Hash::make($validated['password'])
                : null,
            'status' => isset($validated['scheduled_at']) ? 'scheduled' : 'active',
            'started_at' => isset($validated['scheduled_at']) ? null : now(),
        ]);

        $this->log('created', "Created meet room {$room->uid}", 'meet', $room);

        if (!isset($validated['scheduled_at'])) {
            return redirect()->route('meet.room', $room->uid);
        }

        return redirect()->back()->with('success', 'Meeting scheduled.');
    }

    /**
     * PATCH /meet/{uid}/end — end room (host only).
     */
    public function end(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();
        abort_unless($room->owner_id === $request->user()->id, 403);

        $room->end();

        broadcast(new RoomEnded($room))->toOthers();

        $this->log('ended', "Ended meet room {$room->uid}", 'meet', $room);

        return response()->json(['status' => 'ended']);
    }

    // =========================================================================
    // ENTRY GATES
    // =========================================================================

    /**
     * POST /meet/{uid}/password
     * Authenticated user verifies the room password.
     */
    public function unlock(Request $request, string $uid): RedirectResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();
        $validated = $request->validate(['password' => ['required', 'string']]);

        if (!Hash::check($validated['password'], $room->password)) {
            return back()->withErrors(['password' => 'Incorrect password. Please try again.']);
        }

        $request->session()->put("meet_admitted_{$room->id}", true);

        return redirect()->route('meet.room', $uid);
    }

    /**
     * POST /meet/{uid}/guest
     * Unauthenticated guest submits display name + optional password.
     * Stores admission in session, then redirects to the room.
     */
    public function guestJoin(Request $request, string $uid): RedirectResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();

        if ($room->isEnded()) {
            return back()->withErrors(['display_name' => 'This meeting has ended.']);
        }

        if ($room->isFull()) {
            return back()->withErrors(['display_name' => 'This meeting is full.']);
        }

        $validated = $request->validate([
            'display_name' => ['required', 'string', 'min:2', 'max:80'],
            'password' => [$room->hasPassword() ? 'required' : 'nullable', 'string'],
        ]);

        if ($room->hasPassword()) {
            if (!Hash::check($validated['password'], $room->password)) {
                return back()->withErrors(['password' => 'Incorrect password. Please try again.']);
            }
        }


        $request->session()->put("meet_guest_{$room->id}", [
            'name' => $validated['display_name'],
            'admitted' => true,
            'admitted_at' => now()->toIso8601String(),
        ]);
        // \Log::alert('guest user');
        return redirect()->route('meet.room', $uid);
    }

    // =========================================================================
    // PARTICIPANT ACTIONS  (JSON — called from the React room UI)
    // =========================================================================

    /**
     * POST /meet/{uid}/join
     * Works for both authenticated users and guests (user_id nullable).
     */
    public function join(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();

        abort_if($room->isEnded(), 410, 'Room has ended.');
        abort_if($room->isFull(), 403, 'Room is full.');

        $validated = $request->validate([
            'peer_id' => ['required', 'string', 'size:36'],
            'display_name' => ['required', 'string', 'max:80'],
            'video_on' => ['boolean'],
            'audio_on' => ['boolean'],
        ]);

        if ($room->status === 'scheduled') {
            $room->start();
        }

        $userId = $request->user()?->id;
        $isOwner = $userId && $room->owner_id === $userId;

        // $participant = MeetParticipant::create([
        //     'room_id' => $room->id,
        //     'user_id' => $userId,
        //     'display_name' => $validated['display_name'],
        //     'peer_id' => $validated['peer_id'],
        //     'role' => $isOwner ? 'host' : 'participant',
        //     'is_admitted' => $isOwner || !$room->waiting_room,
        //     'video_on' => $validated['video_on'] ?? false,
        //     'audio_on' => $validated['audio_on'] ?? false,
        //     'joined_at' => now(),
        // ]);


        $participant = MeetParticipant::updateOrCreate(
            [
                'room_id' => $room->id,
                'user_id' => $userId,
                'display_name' => $validated['display_name'],
            ],
            [
                'user_id' => $userId,
                'display_name' => $validated['display_name'],
                'peer_id' => $validated['peer_id'],
                'role' => $isOwner ? 'host' : 'participant',
                'is_admitted' => $isOwner || !$room->waiting_room,
                'video_on' => $validated['video_on'] ?? false,
                'audio_on' => $validated['audio_on'] ?? false,
                'joined_at' => now(),
            ]
        );

        // ✅ ADD THIS BLOCK
        if (!$userId) {
            session([
                "meet_guest_{$room->id}" => [
                    'name' => $validated['display_name'],
                    'admitted' => $participant->is_admitted,
                ]
            ]);
        }


        broadcast(new ParticipantJoined($room, $participant))->toOthers();

        return response()->json([
            'participant' => $this->participantResource($participant),
            'admitted' => $participant->is_admitted,
        ]);
    }

    /**
     * POST /meet/{uid}/leave.
     */
    public function leave(Request $request, string $uid): JsonResponse
    {
        \Log::error('Ending room');
        $participant = MeetParticipant::where('peer_id', $request->input('peer_id'))
            ->whereNull('left_at')
            ->firstOrFail();

        $participant->leave();

        $room = MeetRoom::find($participant->room_id);
        $userId = $request->user()?->id;

        broadcast(new ParticipantLeft($room, $participant))->toOthers();

        // Auto-end if owner left and room is now empty
        if ($room && $userId && $room->owner_id === $userId) {
            if ($room->activeParticipants()->count() === 0) {
                $room->end();
                broadcast(new RoomEnded($room))->toOthers();
            }
        }

        return response()->json(['status' => 'left']);
    }

    /**
     * POST /meet/{uid}/signal — relay WebRTC signal to a specific peer.
     */
    public function signal(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();

        $validated = $request->validate([
            'to' => ['required', 'string'],
            'type' => ['required', 'in:offer,answer,ice-candidate'],
            'payload' => ['required'],
            'from_peer_id' => ['required', 'string'],
        ]);

        broadcast(new SignalSent(
            roomUid: $room->uid,
            from: $validated['from_peer_id'],
            to: $validated['to'],
            type: $validated['type'],
            payload: $validated['payload'],
        ))->toOthers();

        return response()->json(['status' => 'sent']);
    }

    /**
     * PATCH /meet/{uid}/admit/{peerId} — admit from waiting room (host only).
     */
    public function admit(Request $request, string $uid, string $peerId): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();
        abort_unless($room->owner_id === $request->user()?->id, 403);

        $participant = MeetParticipant::where('room_id', $room->id)
            ->where('peer_id', $peerId)
            ->firstOrFail();

        $participant->update(['is_admitted' => true]);

        broadcast(new ParticipantJoined($room, $participant))->toOthers();

        return response()->json(['status' => 'admitted']);
    }

    /**
     * PATCH /meet/{uid}/kick/{peerId} — remove participant (host only).
     */
    public function kick(Request $request, string $uid, string $peerId): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();
        abort_unless($room->owner_id === $request->user()?->id, 403);

        $participant = MeetParticipant::where('room_id', $room->id)
            ->where('peer_id', $peerId)
            ->firstOrFail();

        $participant->leave();

        broadcast(new \App\Events\Meet\ParticipantKicked($room->uid, $peerId))->toOthers();

        return response()->json(['status' => 'kicked']);
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private function roomResource(MeetRoom $room): array
    {
        return [
            'id' => $room->id,
            'uid' => $room->uid,
            'name' => $room->name ?? "Room {$room->uid}",
            'status' => $room->status,
            'has_password' => $room->hasPassword(),
            'max_participants' => $room->max_participants,
            'active_participants' => $room->active_participants_count ?? 0,
            'video_enabled' => $room->video_enabled,
            'audio_enabled' => $room->audio_enabled,
            'chat_enabled' => $room->chat_enabled,
            'screen_share_enabled' => $room->screen_share_enabled,
            'recording_enabled' => $room->recording_enabled,
            'waiting_room' => $room->waiting_room,
            'owner_name' => $room->owner?->name ?? 'Host',
            'started_at' => $room->started_at?->toIso8601String(),
            'scheduled_at' => $room->scheduled_at?->toIso8601String(),
            'join_url' => route('meet.room', $room->uid),
        ];
    }

    private function participantResource(MeetParticipant $p): array
    {
        return [
            'id' => $p->id,
            'peer_id' => $p->peer_id,
            'user_id' => $p->user_id,
            'display_name' => $p->display_name,
            'role' => $p->role,
            'is_admitted' => $p->is_admitted,
            'video_on' => $p->video_on,
            'audio_on' => $p->audio_on,
            'screen_sharing' => $p->screen_sharing,
            'hand_raised' => $p->hand_raised,
            'joined_at' => $p->joined_at->toIso8601String(),
        ];
    }


    public function startRecording(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();

        abort_unless($room->owner_id === $request->user()->id, 403, 'Only the host can start recording.');
        abort_unless($room->recording_enabled, 403, 'Recording is not enabled for this room.');
        abort_if($room->isEnded(), 410, 'Room has ended.');

        // Only one active recording at a time
        $existing = MeetRecording::where('room_id', $room->id)
            ->where('status', 'recording')
            ->first();

        if ($existing) {
            return response()->json(['recording_id' => $existing->id, 'status' => 'already_recording']);
        }

        $recording = MeetRecording::create([
            'room_id' => $room->id,
            'initiated_by' => $request->user()->id,
            'disk' => config('meet.recording_disk', 'local'),
            'status' => 'recording',
            'started_at' => now(),
        ]);

        broadcast(new RecordingStarted($room, $recording->id, $request->user()->name))->toOthers();

        $this->log('recording_started', "Started recording in {$room->uid}", 'meet', $room);

        return response()->json([
            'recording_id' => $recording->id,
            'status' => 'recording',
        ]);
    }

    /**
     * POST /meet/{uid}/recording/{recordingId}/chunk
     * Receive a binary WebM chunk from the client's MediaRecorder.
     * The client sends chunks every ~5 seconds via fetch.
     * No auth middleware needed — validated by recording ownership.
     */
    public function recordingChunk(Request $request, string $uid, int $recordingId): JsonResponse
    {
        $recording = MeetRecording::where('id', $recordingId)
            ->where('status', 'recording')
            ->firstOrFail();

        $chunk = $request->getContent();

        if (empty($chunk)) {
            return response()->json(['error' => 'Empty chunk'], 400);
        }

        $disk = $recording->disk ?? 'local';
        $dir = "meet-recordings/{$recording->room_id}";
        $base = $recording->path ?? "{$dir}/rec_{$recordingId}";

        // Append chunk to the recording file
        Storage::disk($disk)->append("{$base}.webm", $chunk);

        // Update path + size on first chunk
        if (!$recording->path) {
            $recording->update(['path' => "{$base}.webm"]);
        }

        // Update size
        $size = Storage::disk($disk)->size("{$base}.webm");
        $recording->update(['size' => $size]);

        return response()->json(['status' => 'ok', 'size' => $size]);
    }

    /**
     * POST /meet/{uid}/recording/{recordingId}/stop
     * Host stops the recording. Marks it as processing → ready.
     */
    public function stopRecording(Request $request, string $uid, int $recordingId): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();
        abort_unless($room->owner_id === $request->user()->id, 403);

        $recording = MeetRecording::where('id', $recordingId)
            ->where('room_id', $room->id)
            ->firstOrFail();

        $recording->finish();   // sets status=processing, stamps ended_at, duration

        // Small recordings: mark ready immediately
        // Large recordings: you'd dispatch a processing job here
        $recording->update(['status' => 'ready']);

        broadcast(new RecordingStopped($room, $recording->id))->toOthers();

        $this->log('recording_stopped', "Stopped recording in {$room->uid}", 'meet', $room);

        return response()->json([
            'recording_id' => $recording->id,
            'status' => 'ready',
            'duration_seconds' => $recording->duration_seconds,
            'size' => $recording->size,
            'download_url' => $recording->downloadUrl(),
        ]);
    }

    /**
     * GET /meet/{uid}/recordings
     * List recordings for this room (host only).
     */
    public function listRecordings(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();
        abort_unless($room->owner_id === $request->user()->id, 403);

        $recordings = $room->recordings()
            ->orderBy('started_at', 'desc')
            ->get()
            ->map(fn($r) => [
                'id' => $r->id,
                'status' => $r->status,
                'size' => $r->size,
                'size_human' => $r->formattedSize(),
                'duration' => $r->formattedDuration(),
                'started_at' => $r->started_at->toIso8601String(),
                'ended_at' => $r->ended_at?->toIso8601String(),
                'download_url' => $r->isReady() ? $r->downloadUrl() : null,
            ]);

        return response()->json(['recordings' => $recordings]);
    }

    /**
     * GET /meet/recording/{id}/download
     * Serve local recording file.
     */
    public function downloadRecording(Request $request, int $id)
    {
        $recording = MeetRecording::findOrFail($id);
        $room = MeetRoom::findOrFail($recording->room_id);

        // Only room owner or the user who initiated recording can download
        abort_unless(
            $room->owner_id === $request->user()->id
            || $recording->initiated_by === $request->user()->id,
            403
        );

        abort_unless($recording->isReady() && $recording->path, 404);

        return Storage::disk($recording->disk)->download(
            $recording->path,
            "meeting-{$room->uid}-recording-{$recording->id}.webm"
        );
    }

    // =========================================================================
    // MEDIA STATE  (replaces whisper — persists state for late joiners)
    // =========================================================================

    /**
     * POST /meet/{uid}/media-state
     * Participant broadcasts their camera/mic/screen/hand state.
     * Using a proper broadcast event so late joiners can fetch state.
     */
    public function updateMediaState(Request $request, string $uid): JsonResponse
    {
        $room = MeetRoom::where('uid', $uid)->firstOrFail();

        $validated = $request->validate([
            'peer_id' => ['required', 'string'],
            'video_on' => ['boolean'],
            'audio_on' => ['boolean'],
            'screen_sharing' => ['boolean'],
            'hand_raised' => ['boolean'],
        ]);

        // Update DB record
        MeetParticipant::where('peer_id', $validated['peer_id'])
            ->where('room_id', $room->id)
            ->update([
                'video_on' => $validated['video_on'] ?? false,
                'audio_on' => $validated['audio_on'] ?? false,
                'screen_sharing' => $validated['screen_sharing'] ?? false,
                'hand_raised' => $validated['hand_raised'] ?? false,
            ]);

        broadcast(new ParticipantMediaUpdated(
            room: $room,
            peerId: $validated['peer_id'],
            videoOn: $validated['video_on'] ?? false,
            audioOn: $validated['audio_on'] ?? false,
            screenSharing: $validated['screen_sharing'] ?? false,
            handRaised: $validated['hand_raised'] ?? false,
        ))->toOthers();

        return response()->json(['status' => 'ok']);
    }

}
