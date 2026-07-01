<?php
// app/Http/Controllers/Api/AudioCallApiController.php
// SDK REST API for third-party integrations — Bearer Sanctum token required.

namespace App\Http\Controllers\Api;

use App\Events\AudioCall\CallEnded;
use App\Events\AudioCall\CallPriorityChanged;
use App\Events\AudioCall\ParticipantKickedFromCall;
use App\Events\AudioCall\ParticipantJoinedCall;
use App\Http\Controllers\Controller;
use App\Models\AudioCall;
use App\Models\AudioCallParticipant;
use App\Traits\ApiResponds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class AudioCallApiController extends Controller
{
    use ApiResponds;

    // ── List calls ─────────────────────────────────────────────────────────────

    public function list(Request $request): JsonResponse
    {
        $calls = AudioCall::where('initiator_id', $request->user()->id)
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->input('priority'), fn ($q, $p) => $q->where('priority', $p))
            ->withCount('activeParticipants')
            ->orderByRaw("FIELD(status,'pending','active','on_hold') DESC, created_at DESC")
            ->paginate(20);

        return $this->paginated($calls, fn ($c) => $this->callResource($c));
    }

    // ── Create call ────────────────────────────────────────────────────────────

    public function create(Request $request): JsonResponse
    {
        $v = $request->validate([
            'title'           => ['nullable', 'string', 'max:100'],
            'mode'            => ['required', 'in:one_to_one,group'],
            'callee_id'       => ['required_if:mode,one_to_one', 'nullable', 'exists:users,id'],
            'priority'        => ['required', 'in:routine,important,urgent,emergency'],
            'priority_note'   => ['nullable', 'string', 'max:255'],
            'max_participants' => ['nullable', 'integer', 'min:2', 'max:200'],
            'password'        => ['nullable', 'string', 'min:4'],
            'waiting_room'    => ['boolean'],
            'mute_on_join'    => ['boolean'],
            'record_enabled'  => ['boolean'],
            'webhook_url'     => ['nullable', 'url'],
            'webhook_events'  => ['nullable', 'array'],
        ]);

        $call = AudioCall::create([
            ...$v,
            'initiator_id' => $request->user()->id,
            'password'     => isset($v['password']) ? Hash::make($v['password']) : null,
            'status'       => 'pending',
        ]);

        $hostToken = $this->makeToken($call, ['display_name' => $request->user()->name, 'role' => 'host']);

        broadcast(new \App\Events\AudioCall\CallInitiated($call->load('initiator')));

        $this->webhook($call, 'call.started', ['uid' => $call->uid, 'priority' => $call->priority]);

        return $this->created([
            'call'       => $this->callResource($call),
            'join_token' => $hostToken,
            'join_url'   => route('calls.room', $call->uid),
        ], 'Call initiated.');
    }

    // ── Get call ───────────────────────────────────────────────────────────────

    public function show(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)
            ->where('initiator_id', $request->user()->id)
            ->withCount('activeParticipants')
            ->firstOrFail();

        return $this->ok([
            'call'         => $this->callResource($call),
            'participants' => $call->activeParticipants()->get()->map(fn ($p) => $this->partResource($p)),
        ]);
    }

    // ── End call ───────────────────────────────────────────────────────────────

    public function end(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->where('initiator_id', $request->user()->id)->firstOrFail();
        $call->end();
        AudioCallParticipant::where('call_id', $call->id)->where('status', 'joined')->each(fn ($p) => $p->leave());
        broadcast(new CallEnded($call, 'host_ended'));
        $this->webhook($call, 'call.ended', ['uid' => $call->uid, 'duration_seconds' => $call->duration_seconds]);
        return $this->noContent();
    }

    // ── Issue join token ───────────────────────────────────────────────────────

    public function issueToken(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->where('initiator_id', $request->user()->id)->firstOrFail();
        if ($call->isEnded()) return $this->gone('Call has ended.');

        $v = $request->validate([
            'display_name' => ['required', 'string', 'max:80'],
            'user_id'      => ['nullable'],
            'role'         => ['nullable', 'in:host,participant'],
        ]);

        return $this->ok([
            'token'     => $this->makeToken($call, $v),
            'join_url'  => route('calls.room', $call->uid),
            'expires_in'=> '2 hours',
        ]);
    }

    // ── Participants ───────────────────────────────────────────────────────────

    public function participants(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->where('initiator_id', $request->user()->id)->firstOrFail();
        $parts = $call->participants()
            ->when($request->boolean('active_only', true), fn ($q) => $q->where('status', 'joined'))
            ->orderBy('joined_at')->get()
            ->map(fn ($p) => $this->partResource($p));
        return $this->ok(['participants' => $parts]);
    }

    public function kick(Request $request, string $uid, string $peerId): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->where('initiator_id', $request->user()->id)->firstOrFail();
        $p    = AudioCallParticipant::where('call_id', $call->id)->where('peer_id', $peerId)->firstOrFail();
        $p->leave('kicked');
        broadcast(new ParticipantKickedFromCall($call->uid, $peerId));
        return $this->noContent();
    }

    public function admit(Request $request, string $uid, string $peerId): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->where('initiator_id', $request->user()->id)->firstOrFail();
        $p    = AudioCallParticipant::where('call_id', $call->id)->where('peer_id', $peerId)->firstOrFail();
        $p->update(['is_admitted' => true, 'status' => 'joined', 'joined_at' => now()]);
        broadcast(new ParticipantJoinedCall($call, $p));
        return $this->ok(['status' => 'admitted']);
    }

    // ── Priority ───────────────────────────────────────────────────────────────

    public function changePriority(Request $request, string $uid): JsonResponse
    {
        $call = AudioCall::where('uid', $uid)->where('initiator_id', $request->user()->id)->firstOrFail();
        $v = $request->validate([
            'priority'      => ['required', 'in:routine,important,urgent,emergency'],
            'priority_note' => ['nullable', 'string', 'max:255'],
        ]);
        $old = $call->priority;
        $call->update($v);
        broadcast(new CallPriorityChanged($call, $old));
        $this->webhook($call, 'call.priority_changed', ['old' => $old, 'new' => $call->priority]);
        return $this->ok($this->callResource($call->fresh()));
    }

    // ── Private ────────────────────────────────────────────────────────────────

    private function makeToken(AudioCall $call, array $attrs): string
    {
        $payload = base64_encode(json_encode([
            'call_uid'     => $call->uid,
            'display_name' => $attrs['display_name'],
            'role'         => $attrs['role'] ?? 'participant',
            'expires_at'   => now()->addHours(2)->timestamp,
        ]));
        return $payload . '.' . hash_hmac('sha256', $payload, config('app.key'));
    }

    private function webhook(AudioCall $call, string $event, array $payload = []): void
    {
        if (!$call->webhook_url) return;
        $events = $call->webhook_events ?? [];
        if (!empty($events) && !in_array($event, $events)) return;
        $ts  = now()->timestamp;
        $sig = hash_hmac('sha256', $call->uid . $ts, config('app.key'));
        try {
            Http::timeout(5)->withHeaders(['X-Defcomm-Signature' => $sig])->post($call->webhook_url, [
                'event' => $event, 'call_uid' => $call->uid,
                'payload' => $payload, 'timestamp' => $ts,
            ]);
        } catch (\Throwable) { /* best-effort */ }
    }

    private function callResource(AudioCall $c): array
    {
        return [
            'uid'                => $c->uid,
            'title'              => $c->title,
            'mode'               => $c->mode,
            'status'             => $c->status,
            'priority'           => $c->priority,
            'priority_label'     => ucfirst($c->priority),
            'priority_color'     => $c->priorityColor(),
            'priority_note'      => $c->priority_note,
            'initiator_name'     => $c->initiator?->name,
            'callee_name'        => $c->callee?->name,
            'active_participants'=> $c->active_participants_count ?? 0,
            'max_participants'   => $c->max_participants,
            'has_password'       => $c->hasPassword(),
            'waiting_room'       => $c->waiting_room,
            'mute_on_join'       => $c->mute_on_join,
            'record_enabled'     => $c->record_enabled,
            'started_at'         => $c->started_at?->toIso8601String(),
            'ended_at'           => $c->ended_at?->toIso8601String(),
            'duration_seconds'   => $c->duration_seconds,
            'join_url'           => route('calls.room', $c->uid),
        ];
    }

    private function partResource(AudioCallParticipant $p): array
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
            'duration_seconds' => $p->duration_seconds,
        ];
    }
}
