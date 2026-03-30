<?php

namespace App\Http\Controllers;

use App\Models\MeetParticipant;
use App\Models\MeetRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;

/**
 * MeetBroadcastController
 *
 * Handles WebSocket channel authentication for the Meet module.
 * This replaces the default /broadcasting/auth route for meet channels
 * so that unauthenticated guests can join presence channels using their
 * session-stored admission token instead of requiring a logged-in user.
 *
 * Route: POST /meet/broadcasting/auth
 * Middleware: web (session only — no auth required)
 */
class MeetBroadcastController extends Controller
{
    public function auth(Request $request): JsonResponse
    {
        $channelName = $request->input('channel_name', '');
        $socketId    = $request->input('socket_id', '');
        $peerId      = $request->input('peer_id', '');

        // ── Only handle meet presence channels ────────────────────────────────
        // Pattern: presence-meet.{uid}
        if (!preg_match('/^presence-meet\.([a-zA-Z0-9\-]+)$/', $channelName, $m)) {
            // Fall through to default Broadcast auth for all other channels
            return response()->json(
                Broadcast::auth($request),
            );
        }

        $roomUid = $m[1];
        $room    = MeetRoom::where('uid', $roomUid)->first();

        if (!$room || $room->isEnded()) {
            return response()->json(['error' => 'Room not found or ended'], 403);
        }

        // ── Resolve identity ──────────────────────────────────────────────────

        $user = $request->user();

        if ($user) {
            // Authenticated user — standard path
            $channelData = [
                'user_id'      => $user->id,
                'peer_id'      => $peerId,
                'display_name' => $user->name,
                'role'         => $room->owner_id === $user->id ? 'host' : 'participant',
            ];
        } else {
            // Guest — validate via session admission token
            $guestSession = $request->session()->get("meet_guest_{$room->id}");

            if (empty($guestSession['admitted'])) {
                return response()->json(['error' => 'Guest not admitted'], 403);
            }

            // Use peer_id as the presence member id for guests
            // (must be unique per connection — peer_id is a UUID)
            $channelData = [
                'user_id'      => $peerId,   // presence channel requires a unique id
                'peer_id'      => $peerId,
                'display_name' => $guestSession['name'] ?? 'Guest',
                'role'         => 'participant',
            ];
        }

        // ── Sign the presence auth response ───────────────────────────────────
        // pusher-js expects: socket_id:channel_name HMAC-SHA256 signed with app secret
        $appKey    = config('broadcasting.connections.reverb.key');
        $appSecret = config('broadcasting.connections.reverb.secret');

        $stringToSign = "{$socketId}:{$channelName}";
        $signature    = hash_hmac('sha256', $stringToSign, $appSecret);

        $auth = "{$appKey}:{$signature}";

        return response()->json([
            'auth'         => $auth,
            'channel_data' => json_encode([
                'user_id'   => $channelData['user_id'],
                'user_info' => [
                    'peer_id'      => $channelData['peer_id'],
                    'display_name' => $channelData['display_name'],
                    'role'         => $channelData['role'],
                ],
            ]),
        ]);
    }
}
