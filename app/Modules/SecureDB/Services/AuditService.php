<?php

namespace App\Modules\SecureDB\Services;

use App\Models\User;
use App\Modules\SecureDB\Models\SecureDbAuditLog;
use App\Modules\SecureDB\Models\SecureDbProject;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AuditService
{
    public function log(
        ?SecureDbProject $project,
        string $action,
        string $description,
        ?User $user = null,
        ?Request $request = null,
        bool $success = true,
        array $metadata = [],
    ): SecureDbAuditLog {
        return SecureDbAuditLog::create([
            'uuid' => (string) Str::uuid(),
            'project_id' => $project?->id,
            'user_id' => $user?->id,
            'action' => $action,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'description' => $description,
            'metadata' => $metadata,
            'success' => $success,
            'created_at' => now(),
        ]);
    }

    public function exportCsv(iterable $logs): string
    {
        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, ['UUID', 'Action', 'User', 'IP', 'Description', 'Success', 'Created At']);

        foreach ($logs as $log) {
            fputcsv($handle, [
                $log->uuid,
                $log->action,
                $log->user?->email ?? 'System',
                $log->ip_address,
                $log->description,
                $log->success ? 'Yes' : 'No',
                $log->created_at?->toDateTimeString(),
            ]);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv ?: '';
    }

    public function exportExcel(iterable $logs): string
    {
        return $this->exportCsv($logs);
    }

    public function exportPdf(iterable $logs): string
    {
        $lines = ["Secure DB Audit Report - " . now()->toDateTimeString(), str_repeat('-', 60)];

        foreach ($logs as $log) {
            $lines[] = sprintf(
                '[%s] %s | %s | %s',
                $log->created_at?->toDateTimeString(),
                $log->action,
                $log->user?->email ?? 'System',
                $log->description
            );
        }

        return implode("\n", $lines);
    }
}
