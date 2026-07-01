<?php
// routes/channels.php
// ─────────────────────────────────────────────────────────────────────────────
// Meet presence channel authorization.
// Called by /broadcasting/auth when Echo.join('meet.{uid}') is called.
//
// MUST work for:
//   (a) Authenticated Defcomm users  — $user is set
//   (b) Unauthenticated guests       — $user is null, check session admission
//
// Requires BroadcastServiceProvider to register with middleware=['web'] only.
// ─────────────────────────────────────────────────────────────────────────────

use App\Models\MeetRoom;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Str;
use App\Models\AudioCall;

// Broadcast::channel('meet.{uid}', function ($user, string $uid) {
//     $room = App\Models\MeetRoom::where('uid', $uid)->first();
//     if (!$room || $room->isEnded())
//         return false;

//     // Use peer_id as the primary ID for Reverb presence channel
//     // This ensures Reverb tracks users by peer_id, not user_id
//     $peerId = request()->input('peer_id', '');
//     if (empty($peerId)) {
//         $peerId = (string) \Illuminate\Support\Str::uuid();
//     }

//     if ($user) {
//         return [
//             'id' => $peerId,                    // ← CRITICAL: Use peer_id as id
//             'peer_id' => $peerId,              // ← Same value
//             'display_name' => $user->name,
//             'role' => $room->owner_id === $user->id ? 'host' : 'participant',
//             'user_id' => $user->id,            // ← Keep original user_id if needed
//         ];
//     }

//     // Guest path
//     $guestSession = request()->session()->get("meet_guest_{$room->id}");
//     if (empty($guestSession['admitted']))
//         return false;

//     return [
//         'id' => $peerId,                       // ← CRITICAL: Use peer_id as id
//         'peer_id' => $peerId,                  // ← Same value
//         'display_name' => $guestSession['name'] ?? 'Guest',
//         'role' => 'participant',
//     ];
// });






Broadcast::channel('meet.{uid}', function ($user, string $uid) {
    $room = MeetRoom::where('uid', $uid)->first();

    if (!$room || $room->isEnded()) {
        return false;
    }

    // peer_id is passed by Echo as a query param during channel auth.
    // It MUST be the presence member `id` so Reverb tracks members by
    // peer_id — not user_id. This is what prevents a user who rejoins
    // (same user_id, new peer_id) from appearing as the old peer.
    $peerId = request()->input('peer_id', '');
    if (empty($peerId)) {
        $peerId = (string) Str::uuid();
    }

    // ── Authenticated user ────────────────────────────────────────────────────
    if ($user) {
        return [
            'id' => $peerId,      // Reverb presence key — MUST be peer_id
            'peer_id' => $peerId,
            'display_name' => $user->name,
            'role' => $room->owner_id === $user->id ? 'host' : 'participant',
            'user_id' => $user->id,
        ];
    }

    // ── Unauthenticated guest ─────────────────────────────────────────────────
    $guestSession = request()->session()->get("meet_guest_{$room->id}");
    if (empty($guestSession['admitted'])) {
        return false;
    }

    return [
        'id' => $peerId,
        'peer_id' => $peerId,
        'display_name' => $guestSession['name'] ?? 'Guest',
        'role' => 'participant',
    ];
}, ['middleware' => ['web']]);


// ─────────────────────────────────────────────────────────────────────────────
// ADD to this file to define more channels for other features (e.g. audio calls).
// ─────────────────────────────────────────────────────────────────────────────

Broadcast::channel('call.{uid}', function ($user, string $uid) {
    $call = AudioCall::where('uid', $uid)->first();
    if (!$call)
        return false;

    $peerId = request()->input('peer_id') ?: (string) \Illuminate\Support\Str::uuid();

    if ($user) {
        $isParticipant = $call->initiator_id === $user->id
            || $call->callee_id === $user->id
            || $call->participants()->where('user_id', $user->id)->exists();

        if (!$isParticipant)
            return false;

        return [
            'id' => $peerId,
            'peer_id' => $peerId,
            'display_name' => $user->name,
            'role' => $call->initiator_id === $user->id ? 'host' : 'participant',
            'user_id' => $user->id,
        ];
    }

    return false; // audio calls are auth-only for now
});

// Personal notification channel — used to ring a user when called
Broadcast::channel('user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});


// Broadcast::channel('meet.{roomId}', function ($user = null, $roomId) {
//     // Always return true for development
//     return true;
// });
