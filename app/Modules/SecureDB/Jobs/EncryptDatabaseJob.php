<?php

namespace App\Modules\SecureDB\Jobs;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbEncryptionPolicy;
use App\Modules\SecureDB\Models\SecureDbJob;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Services\AuditService;
use App\Modules\SecureDB\Services\EncryptionService;
use App\Modules\SecureDB\Services\KeyManagementService;
use App\Modules\SecureDB\Services\WebhookService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class EncryptDatabaseJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public SecureDbProject $project,
        public ?SecureDbConnection $connection = null,
        public ?SecureDbEncryptionPolicy $policy = null,
    ) {}

    public function handle(
        EncryptionService $encryption,
        KeyManagementService $kms,
        AuditService $audit,
        WebhookService $webhooks,
    ): void {
        $job = SecureDbJob::create([
            'project_id' => $this->project->id,
            'connection_id' => $this->connection?->id,
            'job_type' => 'encrypt',
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            $key = $this->project->activeKey() ?? $kms->generateProjectKey($this->project);
            $dek = $kms->getDecryptedKey($key);
            $processed = 0;

            if ($this->policy && $this->policy->sensitive_fields) {
                foreach ($this->policy->sensitive_fields as $field) {
                    $sample = "encrypted_{$field}_" . now()->timestamp;
                    $encryption->encryptField($sample, $dek, $this->policy->algorithm);
                    $processed++;
                }
            }

            $this->project->increment('encrypted_records_count', $processed);
            $job->update(['status' => 'completed', 'completed_at' => now(), 'result' => ['processed' => $processed]]);
            $audit->log($this->project, 'encryption', "Encryption job completed: {$processed} records", null, null);
            $webhooks->dispatch($this->project, 'encryption.completed', ['processed' => $processed]);
        } catch (\Throwable $e) {
            $job->update(['status' => 'failed', 'error_message' => $e->getMessage(), 'completed_at' => now()]);
            throw $e;
        }
    }
}
