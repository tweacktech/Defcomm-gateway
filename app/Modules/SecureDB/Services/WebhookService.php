<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Jobs\WebhookDeliveryJob;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Models\SecureDbWebhook;
use App\Modules\SecureDB\Models\SecureDbWebhookDelivery;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class WebhookService
{
    public function create(SecureDbProject $project, string $url, array $events): array
    {
        $secret = Str::random(64);

        $webhook = SecureDbWebhook::create([
            'project_id' => $project->id,
            'url' => $url,
            'events' => $events,
            'secret_hash' => Hash::make($secret),
        ]);

        return ['webhook' => $webhook, 'secret' => $secret];
    }

    public function dispatch(SecureDbProject $project, string $event, array $payload): void
    {
        $webhooks = $project->webhooks()->where('is_active', true)->get();

        foreach ($webhooks as $webhook) {
            if (! in_array($event, $webhook->events ?? [], true) && ! in_array('*', $webhook->events ?? [], true)) {
                continue;
            }

            $delivery = SecureDbWebhookDelivery::create([
                'webhook_id' => $webhook->id,
                'event' => $event,
                'payload' => $payload,
                'status' => 'pending',
                'next_retry_at' => now(),
            ]);

            WebhookDeliveryJob::dispatch($delivery);
        }
    }
}
