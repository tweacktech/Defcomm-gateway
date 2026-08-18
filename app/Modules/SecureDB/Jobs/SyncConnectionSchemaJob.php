<?php

namespace App\Modules\SecureDB\Jobs;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\DatabaseDiscoveryService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncConnectionSchemaJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public SecureDbConnection $secureDbConnection) {}

    public function handle(ConnectionService $connections, DatabaseDiscoveryService $discovery): void
    {
        if ($connections->testConnection($this->secureDbConnection)) {
            $discovery->sync($this->secureDbConnection->fresh());
        }
    }
}
