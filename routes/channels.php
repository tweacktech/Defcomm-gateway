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

// Broadcast::channel('meet.{uid}', function ($user, string $uid) {
//     $room = MeetRoom::where('uid', $uid)->first();

//     if (!$room) {
//         return false;
//     }

//     // Accept ended rooms too — participants still need to receive room-ended event
//     // (don't block on isEnded here)

//     // peer_id is sent by the React authorizer in the POST body
//     $peerId = request()->input('peer_id') ?: (string) Str::uuid();

//     // ── (a) Authenticated user ────────────────────────────────────────────────
//     if ($user) {
//         return [
//             'id'           => $user->id,          // Reverb uses this for dedup
//             'peer_id'      => $peerId,
//             'display_name' => $user->name,
//             'role'         => $room->owner_id === $user->id ? 'host' : 'participant',
//         ];
//     }

//     // ── (b) Guest — check session ─────────────────────────────────────────────
//     // MeetController::guestJoin() stores ['name'=>..., 'admitted'=>true] in session.
//     $guestData = request()->session()->get("meet_guest_{$room->id}");

//     if ($guestData && ($guestData['admitted'] ?? false)) {
//         // Use session ID suffix as a stable unique ID for this guest
//         $guestId = 'g_' . Str::substr(session()->getId(), 0, 16);
//         return [
//             'id'           => $guestId,
//             'peer_id'      => $peerId,
//             'display_name' => $guestData['name'],
//             'role'         => 'participant',
//         ];
//     }

//     // Not admitted — deny channel authorization
//     return false;
// });




Broadcast::channel('meet.{uid}', function ($user, string $uid) {
    $room = App\Models\MeetRoom::where('uid', $uid)->first();
    if (!$room || $room->isEnded()) return false;

    if ($user) {
        return [
            'id'           => $user->id,
            'peer_id'      => request()->input('peer_id', ''),
            'display_name' => $user->name,
            'role'         => $room->owner_id === $user->id ? 'host' : 'participant',
        ];
    }

    // Guest path — session was already validated by the route above.
    $guestSession = request()->session()->get("meet_guest_{$room->id}");
    if (empty($guestSession['admitted'])) return false;

    $peerId = request()->input('peer_id', '');
    return [
        'id'           => $peerId,
        'peer_id'      => $peerId,
        'display_name' => $guestSession['name'] ?? 'Guest',
        'role'         => 'participant',
    ];
});
