<?php

namespace App\Modules\SecureDB\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

class MonitoringService
{
    public function getSystemMetrics(): array
    {
        $load = function_exists('sys_getloadavg') ? sys_getloadavg() : [0, 0, 0];
        $memoryUsage = memory_get_usage(true);
        $memoryPeak = memory_get_peak_usage(true);

        return [
            'cpu_load' => [
                '1min' => round($load[0] ?? 0, 2),
                '5min' => round($load[1] ?? 0, 2),
                '15min' => round($load[2] ?? 0, 2),
            ],
            'memory' => [
                'current_mb' => round($memoryUsage / 1048576, 2),
                'peak_mb' => round($memoryPeak / 1048576, 2),
            ],
            'queue' => $this->getQueueStatus(),
            'database' => $this->getDatabaseStatus(),
        ];
    }

    public function getQueueStatus(): array
    {
        try {
            $pending = DB::table('jobs')->count();
            $failed = DB::table('failed_jobs')->count();
        } catch (\Throwable) {
            $pending = 0;
            $failed = 0;
        }

        return [
            'connection' => config('queue.default'),
            'pending_jobs' => $pending,
            'failed_jobs' => $failed,
            'status' => $failed > 10 ? 'degraded' : 'healthy',
        ];
    }

    public function getDatabaseStatus(): array
    {
        try {
            DB::select('SELECT 1');

            return ['status' => 'healthy', 'message' => 'Connected'];
        } catch (\Throwable $e) {
            return ['status' => 'unhealthy', 'message' => $e->getMessage()];
        }
    }

    public function getEncryptionPerformance(): array
    {
        $recent = DB::table('secure_db_audit_logs')
            ->where('action', 'encryption')
            ->where('created_at', '>=', now()->subHour())
            ->count();

        return [
            'encryptions_last_hour' => $recent,
            'avg_per_minute' => round($recent / 60, 2),
        ];
    }
}
