<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * TurnCredentialController.php
 *
 * Location: app/Http/Controllers/TurnCredentialController.php
 *
 * This endpoint provides TURN server credentials with short-lived auth tokens
 * to ensure security while allowing WebRTC clients to establish relay connections.
 */

class TurnCredentialController extends Controller
{
    /**
     * Get TURN server credentials
     *
     * Returns an array of ICE servers suitable for RTCPeerConnection configuration.
     * Includes TURN servers with temporary authentication credentials.
     *
     * @return JsonResponse
     */
    public function __invoke(Request $request): JsonResponse
    {
        // Your TURN server configuration from .env
        $turnServer = config('webrtc.turn_server');
        if (!$turnServer) {
            return response()->json(['iceServers' => []], 200);
        }

        // Configuration from docker-compose
        $turnHost = env('TURN_SERVER_HOST', 'localhost');
        $turnPort = (int) env('TURN_SERVER_PORT', 3478);
        $turnUser = env('TURN_SERVER_USER', 'webrtc');
        $turnPass = env('TURN_SERVER_PASS', 'webrtc-secret');
        $turnRealm = env('TURN_SERVER_REALM', 'example.com');

        // Important: Use external IP/domain for ICE server URL
        // The browser needs to connect to your Docker host, not 127.0.0.1
        $externalTurnHost = env('EXTERNAL_TURN_HOST', $turnHost);

        // Generate short-lived TURN credentials (24 hours)
        // This uses the "temporary credentials" mechanism for STUN/TURN
        $expires = time() + (24 * 3600);
        $username = $expires . ':' . $turnUser;

        // HMAC-SHA1 of username with shared secret
        $credential = base64_encode(hash_hmac('sha1', $username, $turnPass, true));

        $iceServers = [
            // STUN servers (for external IP discovery)
            [
                'urls' => [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                ],
            ],
            // TURN server (for relay when direct connection fails)
            [
                'urls' => [
                    "turn:{$externalTurnHost}:{$turnPort}?transport=udp",
                    "turn:{$externalTurnHost}:{$turnPort}?transport=tcp",
                    "turns:{$externalTurnHost}:{$turnPort}?transport=tcp",
                ],
                'username' => $username,
                'credential' => $credential,
                'credentialType' => 'oauth',  // Use 'oauth' for temporary creds
            ],
        ];

        return response()->json(['iceServers' => $iceServers], 200);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// routes/api.php
// ─────────────────────────────────────────────────────────────────────────────

// Add this to your api routes:
// Route::get('/turn-credentials', TurnCredentialController::class);

// ─────────────────────────────────────────────────────────────────────────────
// config/webrtc.php (new config file)
// ─────────────────────────────────────────────────────────────────────────────

// return [
//     'turn_server' => env('TURN_SERVER_HOST'),
//     'turn_port' => (int) env('TURN_SERVER_PORT', 3478),
//     'turn_user' => env('TURN_SERVER_USER', 'webrtc'),
//     'turn_secret' => env('TURN_SERVER_PASS'),
//     'turn_realm' => env('TURN_SERVER_REALM', 'example.com'),
// ];

// ─────────────────────────────────────────────────────────────────────────────
// .env configuration
// ─────────────────────────────────────────────────────────────────────────────

# IMPORTANT: Set EXTERNAL_TURN_HOST to your actual Docker host IP or domain
# For local testing: your machine IP (e.g., 192.168.1.100)
# For production: your domain or server IP that browsers can reach
// TURN_SERVER_HOST=defcomm_turn
// TURN_SERVER_PORT=3478
// TURN_SERVER_USER=webrtc
// TURN_SERVER_PASS=webrtc-secret-key-change-this
// TURN_SERVER_REALM=example.com
// EXTERNAL_TURN_HOST=127.0.0.1  # ← CRITICAL: Change this to your actual IP/domain

# If using Docker Compose with reverse proxy (recommended)
# EXTERNAL_TURN_HOST=yourdomain.com or your_server_ip
