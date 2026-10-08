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
use Illuminate\Support\Facades\Cache;

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
        public ?int $jobRecordId = null,
        public string $operation = 'encrypt',
    ) {}

    public function handle(
        DatabaseEncryptionService $encryptionService,
        AuditService $audit,
        NotificationService $notifications,
        WebhookService $webhooks,
    ): void {
        $connection = SecureDbConnection::with('project')->findOrFail($this->connectionId);
        $user = $this->requestedByUserId ? User::find($this->requestedByUserId) : null;
        $decrypting = $this->operation === 'decrypt';

        $job = $this->jobRecordId
            ? SecureDbJob::find($this->jobRecordId)
            : null;

        $job ??= SecureDbJob::create([
            'project_id' => $connection->project_id,
            'connection_id' => $connection->id,
            'job_type' => 'encrypt',
            'status' => 'running',
            'payload' => $this->payload(),
            'started_at' => now(),
        ]);

        $job->update([
            'status' => 'running',
            'started_at' => $job->started_at ?? now(),
            'payload' => $this->payload(),
        ]);

        $this->storeProgress($job, [
            'percent' => 1,
            'processed' => 0,
            'total' => 1,
            'table' => $this->tableName,
            'message' => $decrypting ? 'Starting decryption…' : 'Starting encryption…',
            'status' => 'running',
            'operation' => $this->operation,
        ]);

        $lastPercent = -1;
        $onProgress = function (array $progress) use ($job, &$lastPercent) {
            $percent = (int) ($progress['percent'] ?? 0);
            if ($percent < 100 && $percent === $lastPercent) {
                return;
            }
            $lastPercent = $percent;
            $this->storeProgress($job, array_merge($progress, [
                'status' => 'running',
                'operation' => $this->operation,
            ]));
        };

        try {
            $result = $decrypting
                ? $encryptionService->decrypt($connection, $this->scope, $this->tableName, $onProgress)
                : $encryptionService->encrypt($connection, $this->scope, $this->algorithm, $this->tableName, $this->fields, $onProgress);

            $job->update([
                'status' => 'completed',
                'completed_at' => now(),
                'result' => $result + ['percent' => 100, 'operation' => $this->operation],
            ]);
            $this->storeProgress($job, [
                'percent' => 100,
                'processed' => $result['processed'] ?? 0,
                'total' => $result['processed'] ?? 0,
                'status' => 'completed',
                'operation' => $this->operation,
                'message' => $decrypting ? 'Decryption complete.' : 'Encryption complete.',
            ]);

            $verb = $decrypting ? 'Decrypted' : 'Encrypted';
            $summary = sprintf(
                '%s %d value(s) across %d table(s).',
                $verb,
                $result['processed'],
                $result['tables'],
            );

            $audit->log($connection->project, $decrypting ? 'decryption' : 'encryption', $summary, $user, null, true);
            $webhooks->dispatch($connection->project, $decrypting ? 'encryption.decrypted' : 'encryption.completed', $result);
            if ($decrypting) {
                $notifications->alertEncryptionCompleted($connection, $user, 'decrypt', $result);
            } else {
                $notifications->alertEncryptionCompleted($connection, $user, $this->scope, $result);
            }
        } catch (\Throwable $e) {
            $job->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'completed_at' => now(),
            ]);
            $this->storeProgress($job, [
                'percent' => 0,
                'status' => 'failed',
                'operation' => $this->operation,
                'message' => $e->getMessage(),
            ]);

            $audit->log($connection->project, $decrypting ? 'decryption' : 'encryption', ($decrypting ? 'Decryption' : 'Encryption').' failed: '.$e->getMessage(), $user, null, false);
            $notifications->alertEncryptionFailed($connection, $user, $this->scope, $e->getMessage());

            throw $e;
        }
    }

    protected function payload(): array
    {
        return [
            'operation' => $this->operation,
            'scope' => $this->scope,
            'algorithm' => $this->algorithm,
            'table' => $this->tableName,
            'fields' => $this->fields,
        ];
    }

    protected function storeProgress(SecureDbJob $job, array $progress): void
    {
        $payload = array_merge([
            'uuid' => $job->uuid,
            'status' => $job->status,
            'operation' => $this->operation,
        ], $progress);

        Cache::put('secure_db_job:'.$job->uuid, $payload, now()->addHours(2));

        $job->forceFill(['result' => $payload])->save();
    }
}
