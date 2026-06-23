<?php

namespace App\Modules\SecureDB\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\SecureDB\Jobs\RotateKeysJob;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Services\AuditService;
use App\Modules\SecureDB\Services\DecryptionService;
use App\Modules\SecureDB\Services\EncryptionService;
use App\Modules\SecureDB\Services\KeyManagementService;
use App\Modules\SecureDB\Services\MonitoringService;
use App\Modules\SecureDB\Services\WebhookService;
use App\Traits\ApiResponds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SecureDbApiController extends Controller
{
    use ApiResponds;

    public function __construct(
        protected EncryptionService $encryption,
        protected KeyManagementService $kms,
        protected DecryptionService $decryption,
        protected AuditService $audit,
        protected MonitoringService $monitoring,
        protected WebhookService $webhooks,
    ) {}

    public function encrypt(Request $request): JsonResponse
    {
        $project = $this->project($request);
        $data = $request->validate([
            'value' => 'required|string',
            'algorithm' => 'nullable|string',
        ]);

        $key = $project->activeKey();
        if (! $key) {
            $key = $this->kms->generateProjectKey($project);
        }

        $dek = $this->kms->getDecryptedKey($key);
        $algo = $data['algorithm'] ?? $key->algorithm;
        $encrypted = $this->encryption->encryptField($data['value'], $dek, $algo);

        $project->increment('encrypted_records_count');
        $this->audit->log($project, 'encryption', 'API encryption request', $request->user(), $request);
        $this->webhooks->dispatch($project, 'encryption.completed', ['via' => 'api']);

        return $this->ok([
            'encrypted' => $encrypted,
            'algorithm' => $algo,
            'key_version' => $key->key_version,
        ], 'Encryption successful.');
    }

    public function decrypt(Request $request): JsonResponse
    {
        $project = $this->project($request);
        $data = $request->validate([
            'value' => 'required|string',
            'algorithm' => 'nullable|string',
        ]);

        $plaintext = $this->decryption->decrypt(
            $project,
            $request->user(),
            $request,
            $data['value'],
            $data['algorithm'] ?? null,
        );

        return $this->ok(['decrypted' => $plaintext], 'Decryption successful.');
    }

    public function rotate(Request $request): JsonResponse
    {
        $project = $this->project($request);
        RotateKeysJob::dispatch($project);
        $this->audit->log($project, 'key_rotation', 'API rotation triggered', $request->user(), $request);

        return $this->ok(['message' => 'Key rotation queued.'], 'Rotation queued.');
    }

    public function status(Request $request): JsonResponse
    {
        $project = $this->project($request);

        return $this->ok([
            'project' => [
                'uuid' => $project->uuid,
                'name' => $project->name,
                'status' => $project->status,
                'encrypted_records' => $project->encrypted_records_count,
                'last_rotation' => $project->last_rotation_at?->toIso8601String(),
            ],
            'connections' => $project->connections()->select('uuid', 'name', 'health_status')->get(),
            'monitoring' => $this->monitoring->getSystemMetrics(),
        ], 'Status retrieved.');
    }

    protected function project(Request $request): SecureDbProject
    {
        return $request->attributes->get('secure_db_project');
    }
}
