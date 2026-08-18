<?php

namespace App\Modules\SecureDB\Jobs;

use App\Models\User;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbJob;
use App\Modules\SecureDB\Services\AuditService;
use App\Modules\SecureDB\Services\DatabaseEncryptionService;
use App\Modules\SecureDB\Services\NotificationService;
use App\Modules\SecureDB\Services\WebhookService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class EncryptConnectionDataJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 3600;

    public function __construct(
        public int $connectionId,
        public string $scope,
        public string $algorithm,
        public ?string $tableName = null,
        public array $fields = [],
        public ?int $requestedByUserId = null,
    ) {}

    public function handle(
        DatabaseEncryptionService $encryptionService,
        AuditService $audit,
        NotificationService $notifications,
        WebhookService $webhooks,
    ): void {
        $connection = SecureDbConnection::with('project')->findOrFail($this->connectionId);
        $user = $this->requestedByUserId ? User::find($this->requestedByUserId) : null;

        $job = SecureDbJob::create([
            'project_id' => $connection->project_id,
            'connection_id' => $connection->id,
            'job_type' => 'encrypt',
            'status' => 'running',
            'payload' => [
                'scope' => $this->scope,
                'algorithm' => $this->algorithm,
                'table' => $this->tableName,
                'fields' => $this->fields,
            ],
            'started_at' => now(),
        ]);

        try {
            $result = $encryptionService->encrypt(
                $connection,
                $this->scope,
                $this->algorithm,
                $this->tableName,
                $this->fields,
            );

            $job->update([
                'status' => 'completed',
                'completed_at' => now(),
                'result' => $result,
            ]);

            $summary = sprintf(
                'Encrypted %d value(s) across %d table(s) using %s.',
                $result['processed'],
                $result['tables'],
                $this->algorithm,
            );

            $audit->log($connection->project, 'encryption', $summary, $user, null, true);
            $webhooks->dispatch($connection->project, 'encryption.completed', $result);
            $notifications->alertEncryptionCompleted($connection, $user, $this->scope, $result);
        } catch (\Throwable $e) {
            $job->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            $audit->log($connection->project, 'encryption', 'Encryption failed: ' . $e->getMessage(), $user, null, false);
            $notifications->alertEncryptionFailed($connection, $user, $this->scope, $e->getMessage());

            throw $e;
        }
    }
}
