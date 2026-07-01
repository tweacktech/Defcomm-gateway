<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class WebRtcHealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $iceServers = config('meet.stun_servers', []);

        $turnChecks = collect($iceServers)
            ->flatMap(function (array $server) {
                $urls = $server['urls'] ?? [];
                return is_array($urls) ? $urls : [$urls];
            })
            ->filter(fn($url) => is_string($url) && (Str::startsWith($url, 'turn:') || Str::startsWith($url, 'turns:')))
            ->map(function (string $url) {
                [$host, $port] = $this->extractHostPort($url);
                return [
                    'url' => $url,
                    'host' => $host,
                    'port' => $port,
                    'tcp_reachable' => $this->tcpReachable($host, $port),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'status' => 'ok',
            'reverb' => [
                'host' => env('VITE_REVERB_HOST', env('REVERB_HOST')),
                'port' => (int) env('VITE_REVERB_PORT', env('REVERB_PORT', 8080)),
                'scheme' => env('VITE_REVERB_SCHEME', env('REVERB_SCHEME', 'http')),
                'app_key_configured' => !empty(config('broadcasting.connections.reverb.key')),
            ],
            'ice_servers_count' => count($iceServers),
            'turn_checks' => $turnChecks,
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    private function extractHostPort(string $url): array
    {
        $withoutProto = preg_replace('/^turns?:/i', '', $url) ?? '';
        $first = explode('?', $withoutProto)[0];
        $hostPort = explode(',', $first)[0];
        if (str_contains($hostPort, ':')) {
            [$host, $port] = explode(':', $hostPort, 2);
            return [$host, (int) $port];
        }
        return [$hostPort, 3478];
    }

    private function tcpReachable(string $host, int $port): bool
    {
        if ($host === '' || $port <= 0) {
            return false;
        }

        $errno = 0;
        $errstr = '';
        $conn = @fsockopen($host, $port, $errno, $errstr, 1.5);
        if (is_resource($conn)) {
            fclose($conn);
            return true;
        }
        return false;
    }
}
