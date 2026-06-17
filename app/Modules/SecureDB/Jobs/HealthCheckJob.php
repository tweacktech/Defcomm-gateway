<?php

namespace App\Modules\SecureDB\Jobs;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\NotificationService;
use App\Modules\SecureDB\Services\WebhookService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class HealthCheckJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public ?int $connectionId = null) {}

    public function handle(ConnectionService $connections, NotificationService $notifications, WebhookService $webhooks): void
    {
        $query = SecureDbConnection::query();
        if ($this->connectionId) {
            $query->where('id', $this->connectionId);
        }

        foreach ($query->get() as $connection) {
            $wasHealthy = $connection->health_status === 'healthy';
            $healthy = $connections->testConnection($connection);

            if ($wasHealthy && ! $healthy) {
                $notifications->alertConnectionFailure($connection->project, $connection->name);
                $webhooks->dispatch($connection->project, 'connection.lost', [
                    'connection' => $connection->uuid,
                    'name' => $connection->name,
                ]);
            }
        }
    }
}
