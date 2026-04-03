<?php

return [
    /*
    |--------------------------------------------------------------------------
    | WebRTC ICE servers (STUN / TURN)
    |--------------------------------------------------------------------------
    |
    | If users are on different networks / behind NAT, STUN alone often isn't
    | enough and calls will fail with "ICE failed". Provide a TURN server to
    | relay media when direct connectivity can't be established.
    |
    | Configure via MEET_ICE_SERVERS as JSON:
    |   [{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"user","credential":"pass"}]
    |
    */
    'stun_servers' => array_values(array_filter(array_merge(
        [
            ['urls' => 'stun:stun.l.google.com:19302'],
            ['urls' => 'stun:stun1.l.google.com:19302'],
        ],
        (static function (): array {
            $raw = env('MEET_ICE_SERVERS');
            if (!$raw) return [];

            $decoded = json_decode($raw, true);
            return is_array($decoded) ? $decoded : [];
        })(),
    ))),
];

