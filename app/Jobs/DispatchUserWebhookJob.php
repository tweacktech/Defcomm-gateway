<?php

namespace App\Jobs;

use App\Models\WebhookSubscription;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class DispatchUserWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    /**
     * Exponential-ish backoff between delivery attempts, in seconds.
     *
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 30, 120, 600, 3600];
    }

    public function __construct(
        public int $subscriptionId,
        public string $event,
        public array $payload
    ) {
    }

    public function handle(): void
    {
        $subscription = WebhookSubscription::find($this->subscriptionId);

        if (!$subscription || !$subscription->is_active) {
            return; // subscription was deleted/disabled since this was queued
        }

        $deliveryId = (string) Str::uuid();
        $body = json_encode([
            'event' => $this->event,
            'delivery_id' => $deliveryId,
            'created_at' => now()->toIso8601String(),
            'data' => $this->payload,
        ], JSON_UNESCAPED_SLASHES);

        $signature = hash_hmac('sha256', $body, $subscription->secret);

        $response = Http::withBody($body, 'application/json')
            ->withHeaders([
                'X-Defcomm-Event' => $this->event,
                'X-Defcomm-Delivery' => $deliveryId,
                'X-Defcomm-Signature' => 'sha256=' . $signature,
            ])
            ->timeout(10)
            ->post($subscription->url);

        $subscription->update([
            'last_triggered_at' => now(),
            'last_response_status' => $response->status(),
            'failure_count' => $response->successful() ? 0 : $subscription->failure_count + 1,
        ]);

        if (!$response->successful()) {
            // Throwing triggers Laravel's retry/backoff via $tries/backoff().
            throw new \RuntimeException(
                "Webhook delivery failed: subscription={$subscription->id} status={$response->status()}"
            );
        }
    }

    public function failed(\Throwable $e): void
    {
        // After all retries are exhausted. Auto-disable chronically failing
        // endpoints so we don't hammer a dead URL forever.
        $subscription = WebhookSubscription::find($this->subscriptionId);

        if ($subscription && $subscription->failure_count >= 10) {
            $subscription->update(['is_active' => false]);
        }
    }
}
