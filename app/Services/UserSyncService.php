<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class UserSyncService
{
    public function syncUsers(): array
    {
        try {
            $response = Http::timeout(60)
                ->get(config('services.user_api.url'));

            if (! $response->successful()) {
                throw new \Exception('Failed to fetch users');
            }

            $users = $response->json();

            $updated = 0;

            foreach ($users as $user) {
                User::updateOrCreate(
                    [
                        'external_id' => $user['id'],
                    ],
                    [
                        'name' => $user['name'],
                        'email' => $user['email'],
                        'phone' => $user['phone'] ?? null,
                        'status' => $user['status'] ?? 'active',
                    ]
                );

                $updated++;
            }

            return [
                'success' => true,
                'count' => $updated,
            ];
        } catch (\Throwable $e) {
            Log::error('User Sync Failed', [
                'message' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
