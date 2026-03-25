<?php

use App\Models\MeetRoom;
use Illuminate\Support\Facades\Broadcast;

// Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
//     return (int) $user->id === (int) $id;
// });

// Broadcast::channel('meet.{uid}', function ($user, $uid) {
//     $room = MeetRoom::where('uid', $uid)->first();
//     if (!$room || $room->isEnded()) {
//         return false;
//     }

//     return [
//         'id' => $user->id,
//         'name' => $user->name,
//         'display_name' => $user->name,
//     ];
// });

// Meet presence channel — authorizes both auth users AND guests (via session).
// The data returned from the callback becomes the member info visible to all
// participants in the room (used by Echo's .here() and .joining() callbacks).
// Broadcast::channel('meet.{uid}', function ($user, $uid) {
//     $room = MeetRoom::where('uid', $uid)->first();

//     // Room must exist and not be ended
//     if (!$room || $room->isEnded()) {
//         return false;
//     }

//     // Authenticated user
//     if ($user) {
//         return [
//             'id' => $user->id,
//             'peer_id' => request()->input('peer_id', (string) Illuminate\Support\Str::uuid()),
//             'display_name' => $user->name,
//             'role' => $room->owner_id === $user->id ? 'host' : 'participant',
//         ];
//     }

//     // Guest — check session admission
//     $guestSession = request()->session()->get("meet_guest_{$room->id}");
//     if ($guestSession && ($guestSession['admitted'] ?? false)) {
//         return [
//             'id' => 'guest_' . session()->getId(),
//             'peer_id' => request()->input('peer_id', (string) Illuminate\Support\Str::uuid()),
//             'display_name' => $guestSession['name'],
//             'role' => 'participant',
//         ];
//     }

//     return false;  // not admitted
// });


use Illuminate\Support\Str;

Broadcast::channel('meet.{uid}', function ($user, $uid) {
    $room = MeetRoom::where('uid', $uid)->first();

    if (!$room || $room->isEnded())
        return false;

    // ✅ Persist peer_id in session
    if (!session()->has('peer_id')) {
        session(['peer_id' => request()->input('peer_id') ?? Str::uuid()]);
    }

    $peerId = session('peer_id');

    if ($user) {
        return [
            'id' => 'user_' . $user->id,
            'peer_id' => $peerId,
            'display_name' => $user->name,
            'role' => $room->owner_id === $user->id ? 'host' : 'participant',
        ];
    }

    $guestSession = session("meet_guest_{$room->id}");

    if ($guestSession && ($guestSession['admitted'] ?? false)) {
        return [
            'id' => 'guest_' . session()->getId(),
            'peer_id' => $peerId, // ✅ FIXED
            'display_name' => $guestSession['name'],
            'role' => 'participant',
        ];
    }

    return false;
});
