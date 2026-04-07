<?php
// app/Http/Controllers/AudioCallController.php

namespace App\Http\Controllers;

use App\Events\AudioCall\CallAnswered;
use App\Events\AudioCall\CallDeclined;
use App\Events\AudioCall\CallEnded;
use App\Events\AudioCall\CallInitiated;
use App\Events\AudioCall\CallPriorityChanged;
use App\Events\AudioCall\CallSignalSent;
use App\Events\AudioCall\CallWaiting;
use App\Events\AudioCall\ParticipantJoinedCall;
use App\Events\AudioCall\ParticipantKickedFromCall;
use App\Events\AudioCall\ParticipantLeftCall;
use App\Events\AudioCall\ParticipantMuted;
use App\Models\AudioCall;
use App\Models\AudioCallParticipant;
use App\Traits\ApiResponds;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AudioCallController extends Controller
{
    use ApiResponds, LogsActivity;

    // =========================================================================
    // PAGES
    // =========================================================================

    /**
     * GET /calls — call history / active calls lobby
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        // Active / recent calls this user was part of
        $calls = AudioCall::whereHas('participants', fn ($q) => $q->where('user_id', $user->id))
            ->orWhere('initiator_id', $user->id)
            ->with(['initiator:id,name', 'callee:id,name'])
            ->withCount('activeParticipants')
            ->orderByRaw("FIELD(status,'pending','active','on_hold') DESC, created_at DESC")
            ->take(20)
            ->get()
            ->map(fn ($c) => $this->callResource($c));

        return Inertia::render('calls/calls-index', [
            'calls' => $calls,
        ]);
    }

    /**
     * GET /calls/{uid} — the call room page
     */
    public function room(Request $request, string $uid): Response|RedirectResponse
    {
        $call = AudioCall::where('uid', $uid)
            ->with(['initiator:id,name', 'callee:id,name'])
            ->firstOrFail();

        if ($call->isEnded()) {
            return Inertia::render('calls/calls-ended', [
                'call' => $this->callResource($call),
            ]);
        }

        $user    = $request->user();
        $peerId  = (string) Str::uuid();
        $isHost  = $call->initiator_id === $user->id;

        return Inertia::render('calls/calls-room', [
            'call'         => $this->callResource($call),
            'peer_id'      => $peerId,
            'display_name' => $user->name,
            'is_host'      => $isHost,
            'reverb_key'   => config('broadcasting.connections.reverb.key'),
            'reverb_host'  => config('broadcasting.connections.reverb.options.host'),
            'reverb_port'  => config('broadcasting.connections.reverb.options.port'),
            'stun_servers' => config('meet.stun_servers', [
                ['urls' => 'stun:stun.l.google.com:19302'],
                ['urls' => 'stun:stun1.l.google.com:19302'],
            ]),
        ]);
    }

    // =========================================================================
    // CALL LIFECYCLE
    // =========================================================================

    /**
     * POST /calls — initiate a new call
     *
     * For one_to_one: callee_id required. The callee receives CallInitiated event
     * on their personal channel so their UI can ring.
     * For group: no callee_id. Participants join via link.
     *
     * Priority levels:
     *   routine   — normal ring, can be declined
     *   important — visual flag, logged
     *   urgent    — overrides DND; auto-answers if callee doesn't respond in 30s
     *   emergency — cannot be declined; bypasses all restrictions
     */
    public function create(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'title'          => ['nullable', 'string', 'max:100'],
            'mode'           => ['required', 'in:one_to_one,group'],
            'callee_id'      => ['required_if:mode,one_to_one', 'nullable', 'exists:users,id'],
            'priority'       => ['required', 'in:routine,important,urgent,emergency'],
            'priority_note'  => ['nullable', 'string', 'max:255'],
            'max_participants'=> ['nullable', 'integer', 'min:2', 'max:200'],
            'password'       => ['nullable', 'string', 'min:4'],
            'waiting_room'   => ['boolean'],
            'mute_on_join'   => ['boolean'],
            'record_enabled' => ['boolean'],
        ]);

        $user = $request->user();

        // Prevent calling yourself
        if (isset($validated['callee_id']) && $validated['callee_id'] == $user->id) {
            return $this->badRequest('You cannot call yourself.');
        }

        $call = AudioCall::create([
            ...$validated,
            'initiator_id' => $user->id,
            'password'     => isset($validated['password']) ? Hash::make($validated['password']) : null,
            'status'       => 'pending',
        ]);

        // Create a host participant record
        AudioCallParticipant::create([
            'call_id'      => $call->id,
            'user_id'      => $user->id,
            'peer_id'      => (string) Str::uuid(),
            'display_name' => $user->name,
            'role'         => 'host',
            'is_admitted'  => true,
            'status'       => 'ringing',
            'audio_on'     => false,
        ]);

        // Notify the callee (one_to_one) or broadcast on a group notification channel
        broadcast(new CallInitiated($call->load('initiator')))->toOthers();

        $this->log('call_initiated', "Initiated {$call->priority} {$call->mode} call", 'audio_call', $call);

        if ($request->wantsJson()) {
            return $this->created([
                'call'     => $this->callResource($call),
                'join_url' => route('calls.room', $call->uid),
            ], 'Call initiated.');
        }

        return redirect()->route('calls.room', $call->uid);
    }

    /**
     * POST /calls/{uid}/answer — callee answers the call
     */
    public function answer(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();

        abort_if($call->isEnded(), 410, 'Call has ended.');
        abort_if($call->isFull(), 403, 'Call is full.');

        $validated = $request->validate([
            'peer_id'      => ['required', 'string', 'size:36'],
            'display_name' => ['required', 'string', 'max:80'],
            'audio_on'     => ['boolean'],
        ]);

        $user     = $request->user();
        $isHost   = $call->initiator_id === $user->id;
        $admitted = $isHost || !$call->waiting_room;

        $participant = AudioCallParticipant::updateOrCreate(
            ['call_id' => $call->id, 'user_id' => $user->id],
            [
                'peer_id'      => $validated['peer_id'],
                'display_name' => $validated['display_name'],
                'role'         => $isHost ? 'host' : 'participant',
                'is_admitted'  => $admitted,
                'audio_on'     => $validated['audio_on'] ?? !$call->mute_on_join,
                'status'       => $admitted ? 'joined' : 'ringing',
                'joined_at'    => $admitted ? now() : null,
            ]
        );

        if ($call->isPending()) {
            $call->start();
        }

        if ($admitted) {
            broadcast(new ParticipantJoinedCall($call, $participant))->toOthers();
        } else {
            broadcast(new CallWaiting($call, $participant))->toOthers();
        }

        return $this->ok([
            'participant' => $this->participantResource($participant),
            'admitted'    => $participant->is_admitted,
        ], 'Joined call.');
    }

    /**
     * POST /calls/{uid}/decline — callee declines
     */
    public function decline(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();
        $user = $request->user();

        // Emergency calls cannot be declined
        if ($call->priority === 'emergency') {
            return $this->forbidden('Emergency priority calls cannot be declined.');
        }

        $participant = AudioCallParticipant::where('call_id', $call->id)
            ->where('user_id', $user->id)
            ->first();

        if ($participant) {
            $participant->update(['status' => 'declined']);
        }

        // If one_to_one and callee declined — end the call
        if ($call->mode === 'one_to_one') {
            $call->end('declined');
            broadcast(new CallDeclined($call->uid, $user->name));
        }

        return $this->ok(null, 'Call declined.');
    }

    /**
     * POST /calls/{uid}/leave — participant leaves
     */
    public function leave(Request $request, string $uid): JsonResponse
    {
        $validated = $request->validate([
            'peer_id' => ['required', 'string'],
        ]);

        $participant = AudioCallParticipant::where('peer_id', $validated['peer_id'])
            ->where('status', 'joined')
            ->firstOrFail();

        $participant->leave();

        $call   = AudioCall::find($participant->call_id);
        $userId = $request->user()?->id;

        broadcast(new ParticipantLeftCall($call, $participant))->toOthers();

        // Host left — auto-end if no one remains
        if ($call && $userId && $call->initiator_id === $userId) {
            if ($call->activeParticipants()->count() === 0) {
                $call->end();
                broadcast(new CallEnded($call, 'host_left'));
            }
        }

        return $this->ok(null, 'Left call.');
    }

    /**
     * PATCH /calls/{uid}/end — host ends the call for everyone
     */
    public function end(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();
        abort_unless($call->initiator_id === $request->user()->id, 403);

        $call->end();

        // Mark all active participants as left
        AudioCallParticipant::where('call_id', $call->id)
            ->where('status', 'joined')
            ->each(fn ($p) => $p->leave());

        broadcast(new CallEnded($call, 'host_ended'))->toOthers();

        $this->log('call_ended', "Ended call {$call->uid}", 'audio_call', $call);

        return $this->ok(null, 'Call ended.');
    }

    /**
     * PATCH /calls/{uid}/hold — host places call on hold
     */
    public function hold(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();
        abort_unless($call->initiator_id === $request->user()->id, 403);
        $call->hold();
        return $this->ok(null, 'Call placed on hold.');
    }

    /**
     * PATCH /calls/{uid}/resume — host resumes from hold
     */
    public function resume(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();
        abort_unless($call->initiator_id === $request->user()->id, 403);
        $call->resume();
        return $this->ok(null, 'Call resumed.');
    }

    // =========================================================================
    // PRIORITY MANAGEMENT
    // =========================================================================

    /**
     * PATCH /calls/{uid}/priority — escalate or change priority mid-call
     * Host only. Broadcasts to all participants.
     */
    public function changePriority(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();
        abort_unless($call->initiator_id === $request->user()->id, 403);
        abort_if($call->isEnded(), 410, 'Call has ended.');

        $validated = $request->validate([
            'priority'      => ['required', 'in:routine,important,urgent,emergency'],
            'priority_note' => ['nullable', 'string', 'max:255'],
        ]);

        $oldPriority = $call->priority;
        $call->update([
            'priority'      => $validated['priority'],
            'priority_note' => $validated['priority_note'] ?? $call->priority_note,
        ]);

        broadcast(new CallPriorityChanged($call, $oldPriority))->toOthers();

        $this->log('priority_changed', "Changed call {$call->uid} priority: {$oldPriority} → {$call->priority}", 'audio_call', $call);

        return $this->ok($this->callResource($call->fresh()), 'Priority updated.');
    }

    // =========================================================================
    // PARTICIPANT MANAGEMENT
    // =========================================================================

    /**
     * PATCH /calls/{uid}/admit/{peerId} — admit from waiting room (host only)
     */
    public function admit(Request $request, string $uid, string $peerId): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();
        abort_unless($call->initiator_id === $request->user()->id, 403);

        $participant = AudioCallParticipant::where('call_id', $call->id)
            ->where('peer_id', $peerId)
            ->firstOrFail();

        $participant->update([
            'is_admitted' => true,
            'status'      => 'joined',
            'joined_at'   => now(),
        ]);

        // Broadcast to ALL so the waiting participant's overlay drops
        broadcast(new ParticipantJoinedCall($call, $participant));

        return $this->ok(null, 'Participant admitted.');
    }

    /**
     * PATCH /calls/{uid}/kick/{peerId} — remove a participant (host only)
     */
    public function kick(Request $request, string $uid, string $peerId): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();
        abort_unless($call->initiator_id === $request->user()->id, 403);

        $participant = AudioCallParticipant::where('call_id', $call->id)
            ->where('peer_id', $peerId)
            ->firstOrFail();

        $participant->leave('kicked');

        broadcast(new ParticipantKickedFromCall($call->uid, $peerId))->toOthers();

        return $this->noContent();
    }

    /**
     * PATCH /calls/{uid}/mute/{peerId} — mute a participant by host
     */
    public function muteParticipant(Request $request, string $uid, string $peerId): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();
        abort_unless($call->initiator_id === $request->user()->id, 403);

        $participant = AudioCallParticipant::where('call_id', $call->id)
            ->where('peer_id', $peerId)
            ->firstOrFail();

        $participant->update(['is_muted_by_host' => true, 'audio_on' => false]);

        broadcast(new ParticipantMuted($call->uid, $peerId, true, byHost: true))->toOthers();

        return $this->ok(null, 'Participant muted.');
    }

    // =========================================================================
    // SIGNALING  (WebRTC offer/answer/ICE relay)
    // =========================================================================

    /**
     * POST /calls/{uid}/signal
     */
    public function signal(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();

        $validated = $request->validate([
            'to'           => ['required', 'string'],
            'type'         => ['required', 'in:offer,answer,ice-candidate'],
            'payload'      => ['required'],
            'from_peer_id' => ['required', 'string'],
        ]);

        broadcast(new CallSignalSent(
            callUid: $call->uid,
            from:    $validated['from_peer_id'],
            to:      $validated['to'],
            type:    $validated['type'],
            payload: $validated['payload'],
        ))->toOthers();

        return $this->ok(null, 'Signal sent.');
    }

    /**
     * POST /calls/{uid}/audio-state — participant toggles mute
     */
    public function audioState(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->firstOrFail();

        $validated = $request->validate([
            'peer_id'  => ['required', 'string'],
            'audio_on' => ['required', 'boolean'],
        ]);

        AudioCallParticipant::where('call_id', $call->id)
            ->where('peer_id', $validated['peer_id'])
            ->update(['audio_on' => $validated['audio_on']]);

        broadcast(new ParticipantMuted(
            $call->uid,
            $validated['peer_id'],
            !$validated['audio_on'],
            false
        ))->toOthers();

        return $this->ok(null);
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private function callResource(AudioCall $call): array
    {
        $priority = $call->priority;
        return [
            'uid'                => $call->uid,
            'title'              => $call->title ?? ($call->mode === 'one_to_one' ? "Call with {$call->callee?->name}" : 'Group Call'),
            'mode'               => $call->mode,
            'status'             => $call->status,
            'priority'           => $priority,
            'priority_label'     => ucfirst($priority),
            'priority_color'     => $call->priorityColor(),
            'priority_note'      => $call->priority_note,
            'initiator_name'     => $call->initiator?->name,
            'callee_name'        => $call->callee?->name,
            'active_participants'=> $call->active_participants_count ?? 0,
            'max_participants'   => $call->max_participants,
            'has_password'       => $call->hasPassword(),
            'waiting_room'       => $call->waiting_room,
            'mute_on_join'       => $call->mute_on_join,
            'record_enabled'     => $call->record_enabled,
            'started_at'         => $call->started_at?->toIso8601String(),
            'ended_at'           => $call->ended_at?->toIso8601String(),
            'duration_seconds'   => $call->duration_seconds,
            'join_url'           => route('calls.room', $call->uid),
        ];
    }

    private function participantResource(AudioCallParticipant $p): array
    {
        return [
            'peer_id'          => $p->peer_id,
            'display_name'     => $p->display_name,
            'role'             => $p->role,
            'is_admitted'      => $p->is_admitted,
            'audio_on'         => $p->audio_on,
            'hand_raised'      => $p->hand_raised,
            'is_muted_by_host' => $p->is_muted_by_host,
            'status'           => $p->status,
            'joined_at'        => $p->joined_at?->toIso8601String(),
        ];
    }
}