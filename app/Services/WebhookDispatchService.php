<?php

namespace App\Services\Auth;

use App\Jobs\DispatchUserWebhookJob;
use App\Models\WebhookSubscription;

class WebhookDispatchService
{
    /**
     * Queue a delivery for every active subscription listening to $event.
     *
     * @param string $event e.g. "user.created" | "user.updated" | "user.deleted"
     * @param array<string, mixed> $payload
     */
    public static function dispatch(string $event, array $payload): void
    {
        WebhookSubscription::query()
            ->where('is_active', true)
            ->get()
            ->filter(fn (WebhookSubscription $sub) => $sub->subscribesTo($event))
            ->each(fn (WebhookSubscription $sub) => DispatchUserWebhookJob::dispatch(
                $sub->id,
                $event,
                $payload
            ));
    }
}
