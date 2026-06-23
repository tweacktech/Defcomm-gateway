<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbKey;
use App\Modules\SecureDB\Models\SecureDbProject;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use RuntimeException;

class KeyManagementService
{
    public function __construct(
        protected EncryptionService $encryption
    ) {}

    public function generateProjectKey(SecureDbProject $project, string $keyType = 'project', ?int $userId = null): SecureDbKey
    {
        $dek = random_bytes(32);
        $masterKey = $this->getMasterKey();
        $encryptedDek = Crypt::encryptString(base64_encode($dek));

        $version = (string) ((int) ($project->keys()->max('key_version') ?? 0) + 1);

        return SecureDbKey::create([
            'project_id' => $project->id,
            'created_by' => $userId,
            'key_type' => $keyType,
            'key_version' => $version,
            'encrypted_key_material' => $encryptedDek,
            'encrypted_dek' => $encryptedDek,
            'algorithm' => $project->default_algorithm ?? EncryptionService::AES_256_GCM,
            'status' => 'active',
        ]);
    }

    public function generateSessionKey(SecureDbProject $project, int $ttlMinutes = 60): SecureDbKey
    {
        return SecureDbKey::create([
            'project_id' => $project->id,
            'key_type' => 'session',
            'key_version' => 'session-' . Str::random(8),
            'encrypted_key_material' => Crypt::encryptString(base64_encode(random_bytes(32))),
            'algorithm' => $project->default_algorithm ?? EncryptionService::AES_256_GCM,
            'status' => 'active',
            'expires_at' => now()->addMinutes($ttlMinutes),
        ]);
    }

    public function getDecryptedKey(SecureDbKey $key): string
    {
        if ($key->status === 'revoked') {
            throw new RuntimeException('Key has been revoked.');
        }

        if ($key->expires_at && $key->expires_at->isPast()) {
            throw new RuntimeException('Session key has expired.');
        }

        $material = Crypt::decryptString($key->encrypted_key_material);

        return base64_decode($material);
    }

    public function rotateProjectKey(SecureDbProject $project, ?int $userId = null): SecureDbKey
    {
        $project->keys()
            ->where('key_type', 'project')
            ->where('status', 'active')
            ->update(['status' => 'archived', 'rotated_at' => now()]);

        return $this->generateProjectKey($project, 'project', $userId);
    }

    public function revokeKey(SecureDbKey $key): void
    {
        $key->update([
            'status' => 'revoked',
            'revoked_at' => now(),
        ]);
    }

    public function backupKey(SecureDbKey $key): array
    {
        return [
            'uuid' => $key->uuid,
            'key_type' => $key->key_type,
            'key_version' => $key->key_version,
            'algorithm' => $key->algorithm,
            'encrypted_material' => $key->encrypted_key_material,
            'backed_up_at' => now()->toIso8601String(),
        ];
    }

    public function recoverKey(array $backup): SecureDbKey
    {
        $existing = SecureDbKey::where('uuid', $backup['uuid'])->first();
        if ($existing) {
            return $existing;
        }

        throw new RuntimeException('Key recovery requires matching project context.');
    }

    protected function getMasterKey(): string
    {
        return config('app.key');
    }
}
