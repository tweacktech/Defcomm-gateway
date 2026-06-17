<?php

namespace App\Modules\SecureDB\Services;

use App\Models\User;
use App\Modules\SecureDB\Models\SecureDbAuditLog;
use App\Modules\SecureDB\Models\SecureDbDevice;
use App\Modules\SecureDB\Models\SecureDbEncryptedMetadata;
use App\Modules\SecureDB\Models\SecureDbEncryptionPolicy;
use App\Modules\SecureDB\Models\SecureDbProject;
use Illuminate\Http\Request;
use RuntimeException;

class DecryptionService
{
    public function __construct(
        protected EncryptionService $encryption,
        protected KeyManagementService $kms,
        protected AuditService $audit,
        protected PermissionService $permissions,
    ) {}

    public function decrypt(
        SecureDbProject $project,
        ?User $user,
        Request $request,
        string $encryptedValue,
        ?string $algorithm = null,
        ?SecureDbDevice $device = null,
    ): string {
        $isApiAuth = $request->attributes->has('secure_db_project');

        if (! $isApiAuth) {
            $this->permissions->authorize($user, $project, 'decrypt');
        }

        if ($device && $device->status !== 'approved') {
            $this->audit->log($project, 'failed_access', 'Decryption blocked: device not approved', $user, $request, false);
            throw new RuntimeException('Device not authorized for decryption.');
        }

        if (! $isApiAuth && $user && ! $this->validateSession($request)) {
            $this->audit->log($project, 'failed_access', 'Decryption blocked: invalid session', $user, $request, false);
            throw new RuntimeException('Invalid session for decryption.');
        }

        $key = $project->activeKey();
        if (! $key) {
            throw new RuntimeException('No active encryption key for project.');
        }

        try {
            $dek = $this->kms->getDecryptedKey($key);
            $algo = $algorithm ?? $key->algorithm;
            $plaintext = $this->encryption->decryptField($encryptedValue, $dek, $algo);

            $this->audit->log($project, 'decryption', 'Record decrypted successfully', $user, $request, true, [
                'algorithm' => $algo,
                'key_version' => $key->key_version,
            ]);

            return $plaintext;
        } catch (\Throwable $e) {
            $this->audit->log($project, 'failed_access', 'Decryption failed: ' . $e->getMessage(), $user, $request, false);
            throw $e;
        }
    }

    public function decryptWithPolicy(
        SecureDbProject $project,
        ?User $user,
        Request $request,
        SecureDbEncryptionPolicy $policy,
        array $record,
        ?SecureDbDevice $device = null,
    ): array {
        $fields = $policy->sensitive_fields ?? [];

        $key = $project->activeKey();
        if (! $key) {
            throw new RuntimeException('No active encryption key.');
        }

        $dek = $this->kms->getDecryptedKey($key);
        $decrypted = $this->encryption->decryptRow($record, $fields, $dek, $policy->algorithm);

        $this->audit->log($project, 'decryption', "Decrypted row via policy {$policy->name}", $user, $request);

        return $decrypted;
    }

    protected function validateSession(Request $request): bool
    {
        return $request->hasSession() && $request->session()->isStarted();
    }
}
