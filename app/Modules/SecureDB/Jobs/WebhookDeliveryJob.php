<?php

namespace App\Modules\SecureDB\Jobs;

use App\Modules\SecureDB\Models\SecureDbWebhookDelivery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class WebhookDeliveryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public SecureDbWebhookDelivery $delivery) {}

    public function handle(): void
    {
        $webhook = $this->delivery->webhook;
        if (! $webhook || ! $webhook->is_active) {
            return;
        }

        try {
            $response = Http::timeout(10)->post($webhook->url, [
                'event' => $this->delivery->event,
                'payload' => $this->delivery->payload,
                'timestamp' => now()->toIso8601String(),
            ]);

            $this->delivery->update([
                'status' => $response->successful() ? 'delivered' : 'failed',
                'attempts' => $this->delivery->attempts + 1,
                'response_code' => $response->status(),
                'response_body' => substr($response->body(), 0, 1000),
            ]);

            if (! $response->successful() && $this->delivery->attempts < $webhook->max_retries) {
                $this->delivery->update(['next_retry_at' => now()->addMinutes(5 * $this->delivery->attempts)]);
                self::dispatch($this->delivery)->delay(now()->addMinutes(5));
            }
        } catch (\Throwable $e) {
            $this->delivery->update([
                'status' => 'failed',
                'attempts' => $this->delivery->attempts + 1,
                'response_body' => $e->getMessage(),
                'next_retry_at' => now()->addMinutes(5),
            ]);
        }
    }
}
