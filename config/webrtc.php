<?php 




return [
    'turn_server' => env('TURN_SERVER_HOST'),
    'turn_port' => (int) env('TURN_SERVER_PORT', 3478),
    'turn_user' => env('TURN_SERVER_USER', 'webrtc'),
    'turn_secret' => env('TURN_SERVER_PASS'),
    'turn_realm' => env('TURN_SERVER_REALM', 'example.com'),
];
