<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FirebaseService
{
    public function isEnabled(): bool
    {
        return (bool) config('services.firebase.enabled', false);
    }

    public function sendToToken(string $fcmToken, string $title, string $body, array $data = []): bool
    {
        if (! $this->isEnabled() || $fcmToken === '') {
            return false;
        }

        try {
            $serverKey = config('services.firebase.server_key');
            if (! $serverKey) {
                return false;
            }

            $response = Http::withHeaders([
                'Authorization' => 'key='.$serverKey,
                'Content-Type' => 'application/json',
            ])->post('https://fcm.googleapis.com/fcm/send', [
                'to' => $fcmToken,
                'notification' => compact('title', 'body'),
                'data' => $data,
                'priority' => 'high',
            ]);

            return $response->successful();
        } catch (\Throwable $e) {
            Log::warning('FCM send failed: '.$e->getMessage());

            return false;
        }
    }

    public function sendToUser(object $user, string $title, string $body, array $data = []): bool
    {
        $token = $user->fcm_token ?? $user->device_token ?? null;

        return $token ? $this->sendToToken($token, $title, $body, $data) : false;
    }

    public function sendDataOnlyToToken(string $fcmToken, array $data = []): bool
    {
        if (! $this->isEnabled() || $fcmToken === '') {
            return false;
        }

        try {
            $serverKey = config('services.firebase.server_key');
            if (! $serverKey) {
                return false;
            }

            $response = Http::withHeaders([
                'Authorization' => 'key='.$serverKey,
                'Content-Type' => 'application/json',
            ])->post('https://fcm.googleapis.com/fcm/send', [
                'to' => $fcmToken,
                'data' => $data,
                'priority' => 'high',
                'content_available' => true,
            ]);

            return $response->successful();
        } catch (\Throwable $e) {
            Log::warning('FCM data send failed: '.$e->getMessage());

            return false;
        }
    }
}
