<?php

namespace App\Modules\SecureDB\Jobs;

use App\Modules\SecureDB\Models\SecureDbDevice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class DeviceMonitoringJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        SecureDbDevice::where('status', 'approved')
            ->where('last_seen_at', '<', now()->subDays(30))
            ->update(['status' => 'revoked']);
    }
}
