<?php

namespace App\Observers;

use App\Models\User;
use App\Services\Auth\WebhookDispatchService;

class UserObserver
{
    public function created(User $user): void
    {
        WebhookDispatchService::dispatch('user.created', $this->publicPayload($user));
    }

    public function updated(User $user): void
    {
        // Only fire if something externally-relevant actually changed, to
        // avoid noisy deliveries on every unrelated touch (e.g. last_login).
        $relevant = ['name', 'email', 'profile_photo_path'];
        if (!array_intersect($relevant, array_keys($user->getChanges()))) {
            return;
        }

        WebhookDispatchService::dispatch('user.updated', $this->publicPayload($user));
    }

    public function deleted(User $user): void
    {
        WebhookDispatchService::dispatch('user.deleted', [
            'id' => $user->id,
        ]);
    }

    /**
     * Only ever send non-sensitive fields to external services.
     */
    private function publicPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->profile_photo_url ?? null,
            'updated_at' => $user->updated_at?->toIso8601String(),
        ];
    }
}
