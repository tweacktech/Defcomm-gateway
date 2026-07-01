<?php

return [
    /*
    |--------------------------------------------------------------------------
    | WebRTC ICE servers (STUN / TURN)
    |--------------------------------------------------------------------------
    |
    | Used by Meet and Calls Inertia pages. Default STUN is public Google STUN.
    |
    | Docker coturn (see docker-compose) uses long-term credentials. Set:
    |   TURN_USERNAME, TURN_PASSWORD (or TURN_SECRET), TURN_HOST, TURN_PORT
    | From the browser on the host machine, TURN_HOST=127.0.0.1 works when
    | coturn publishes 3478/5349 to the host.
    |
    | Optional extra servers as JSON (merged last):
    |   MEET_ICE_SERVERS='[{"urls":"stun:..."}]'
    |
    */
    'stun_servers' => array_values(array_filter(array_merge(
        [
            ['urls' => 'stun:stun.l.google.com:19302'],
            ['urls' => 'stun:stun1.l.google.com:19302'],
        ],
        (static function (): array {
            $user = env('TURN_USERNAME');
            $cred = env('TURN_PASSWORD', env('TURN_SECRET'));
            $host = env('TURN_HOST', env('VITE_TURN_HOST', '127.0.0.1'));
            $port = (int) env('TURN_PORT', env('VITE_TURN_PORT', 3478));
            if (! $user || ! $cred || $host === '') {
                return [];
            }

            $tlsPort = (int) env('TURNS_PORT', 5349);
            $useTlsTurn = filter_var(env('TURN_TLS', false), FILTER_VALIDATE_BOOLEAN);

            return array_filter([
                [
                    'urls' => 'turn:'.$host.':'.$port,
                    'username' => $user,
                    'credential' => $cred,
                ],
                [
                    'urls' => 'turn:'.$host.':'.$port.'?transport=tcp',
                    'username' => $user,
                    'credential' => $cred,
                ],
                ($useTlsTurn && $tlsPort > 0) ? [
                    'urls' => 'turns:'.$host.':'.$tlsPort,
                    'username' => $user,
                    'credential' => $cred,
                ] : null,
            ]);
        })(),
        (static function (): array {
            $raw = env('MEET_ICE_SERVERS');
            if (! $raw) {
                return [];
            }

            $decoded = json_decode($raw, true);

            return is_array($decoded) ? $decoded : [];
        })(),
    ))),
];

