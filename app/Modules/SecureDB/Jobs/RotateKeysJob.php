<?php

namespace App\Modules\SecureDB\Jobs;

use App\Modules\SecureDB\Models\SecureDbJob;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Models\SecureDbRotationLog;
use App\Modules\SecureDB\Services\AuditService;
use App\Modules\SecureDB\Services\EncryptionService;
use App\Modules\SecureDB\Services\KeyManagementService;
use App\Modules\SecureDB\Services\NotificationService;
use App\Modules\SecureDB\Services\WebhookService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class RotateKeysJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public SecureDbProject $project) {}

    public function handle(
        KeyManagementService $kms,
        EncryptionService $encryption,
        AuditService $audit,
        WebhookService $webhooks,
        NotificationService $notifications,
    ): void {
        $job = SecureDbJob::create([
            'project_id' => $this->project->id,
            'job_type' => 'rotate',
            'status' => 'running',
            'started_at' => now(),
        ]);

        $oldKey = $this->project->activeKey();
        $rotationLog = SecureDbRotationLog::create([
            'project_id' => $this->project->id,
            'old_key_id' => $oldKey?->id,
            'status' => 'started',
            'started_at' => now(),
        ]);

        try {
            $newKey = $kms->rotateProjectKey($this->project);
            $rotationLog->update([
                'new_key_id' => $newKey->id,
                'status' => 'completed',
                'records_processed' => $this->project->encrypted_records_count,
                'completed_at' => now(),
            ]);

            $this->project->update(['last_rotation_at' => now()]);
            $job->update(['status' => 'completed', 'completed_at' => now()]);
            $audit->log($this->project, 'key_rotation', 'Key rotation completed successfully');
            $webhooks->dispatch($this->project, 'rotation.completed', ['key_version' => $newKey->key_version]);
        } catch (\Throwable $e) {
            if ($oldKey) {
                $oldKey->update(['status' => 'active']);
            }
            $rotationLog->update(['status' => 'rolled_back', 'error_message' => $e->getMessage(), 'completed_at' => now()]);
            $job->update(['status' => 'failed', 'error_message' => $e->getMessage(), 'completed_at' => now()]);
            $notifications->alertRotationFailure($this->project, $e->getMessage());
            throw $e;
        }
    }
}
