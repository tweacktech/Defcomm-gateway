<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbAuditLog;
use App\Modules\SecureDB\Models\SecureDbDevice;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Models\SecureDbRotationLog;

class ReportService
{
    public function encryptionReport(SecureDbProject $project, ?string $from = null, ?string $to = null): array
    {
        $query = SecureDbAuditLog::where('project_id', $project->id)->where('action', 'encryption');
        $this->applyDateRange($query, $from, $to);

        return [
            'total_encryptions' => (clone $query)->count(),
            'successful' => (clone $query)->where('success', true)->count(),
            'failed' => (clone $query)->where('success', false)->count(),
            'records' => $project->encrypted_records_count,
        ];
    }

    public function decryptionReport(SecureDbProject $project, ?string $from = null, ?string $to = null): array
    {
        $query = SecureDbAuditLog::where('project_id', $project->id)->where('action', 'decryption');
        $this->applyDateRange($query, $from, $to);

        return [
            'total_decryptions' => (clone $query)->count(),
            'successful' => (clone $query)->where('success', true)->count(),
            'failed' => (clone $query)->where('success', false)->count(),
        ];
    }

    public function deviceReport(SecureDbProject $project): array
    {
        return [
            'total' => $project->devices()->count(),
            'approved' => $project->devices()->where('status', 'approved')->count(),
            'pending' => $project->devices()->where('status', 'pending')->count(),
            'revoked' => $project->devices()->where('status', 'revoked')->count(),
            'blocked' => $project->devices()->where('status', 'blocked')->count(),
        ];
    }

    public function auditReport(SecureDbProject $project, ?string $from = null, ?string $to = null): array
    {
        $query = SecureDbAuditLog::where('project_id', $project->id);
        $this->applyDateRange($query, $from, $to);

        return [
            'total_events' => (clone $query)->count(),
            'by_action' => (clone $query)->selectRaw('action, count(*) as count')
                ->groupBy('action')->pluck('count', 'action'),
            'failed_attempts' => (clone $query)->where('success', false)->count(),
        ];
    }

    public function complianceReport(SecureDbProject $project): array
    {
        $rotations = SecureDbRotationLog::where('project_id', $project->id)
            ->where('status', 'completed')
            ->count();

        return [
            'encryption_enabled' => $project->status === 'active',
            'active_keys' => $project->keys()->where('status', 'active')->count(),
            'completed_rotations' => $rotations,
            'last_rotation' => $project->last_rotation_at?->toIso8601String(),
            'healthy_connections' => $project->connections()->where('health_status', 'healthy')->count(),
            'total_connections' => $project->connections()->count(),
        ];
    }

    protected function applyDateRange($query, ?string $from, ?string $to): void
    {
        if ($from) {
            $query->where('created_at', '>=', $from);
        }
        if ($to) {
            $query->where('created_at', '<=', $to);
        }
    }
}
