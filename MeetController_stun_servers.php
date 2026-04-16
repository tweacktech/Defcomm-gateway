<?php
// ── DROP-IN replacement for the stun_servers prop in renderRoom() ─────────────
// Reads TURN config from .env so local and production use different servers.

'stun_servers' => array_filter([
    // Google STUN — always included
    ['urls' => 'stun:stun.l.google.com:19302'],
    ['urls' => 'stun:stun1.l.google.com:19302'],

    // TURN UDP — primary relay
    env('TURN_USERNAME') ? [
        'urls'       => 'turn:' . env('VITE_TURN_HOST', 'localhost') . ':' . env('VITE_TURN_PORT', 3478),
        'username'   => env('TURN_USERNAME'),
        'credential' => env('TURN_PASSWORD'),
    ] : null,

    // TURN TCP — fallback when UDP is blocked
    env('TURN_USERNAME') ? [
        'urls'       => 'turn:' . env('VITE_TURN_HOST', 'localhost') . ':' . env('VITE_TURN_PORT', 3478) . '?transport=tcp',
        'username'   => env('TURN_USERNAME'),
        'credential' => env('TURN_PASSWORD'),
    ] : null,

    // TURNS (TLS) — fallback on port 5349
    env('TURN_USERNAME') ? [
        'urls'       => 'turns:' . env('VITE_TURN_HOST', 'localhost') . ':5349',
        'username'   => env('TURN_USERNAME'),
        'credential' => env('TURN_PASSWORD'),
    ] : null,
]);
