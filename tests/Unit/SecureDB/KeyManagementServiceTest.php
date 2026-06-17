<?php

namespace Tests\Unit\SecureDB;

use App\Models\User;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Services\EncryptionService;
use App\Modules\SecureDB\Services\KeyManagementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class KeyManagementServiceTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_generates_and_decrypts_project_keys(): void
    {
        $user = User::factory()->create();
        $project = SecureDbProject::create([
            'owner_id' => $user->id,
            'name' => 'KMS Test',
            'api_key' => Str::random(32),
            'secret_key_hash' => Hash::make('secret'),
            'status' => 'active',
            'environment' => 'development',
            'encryption_mode' => 'field',
            'rotation_interval' => 'daily',
        ]);

        $kms = app(KeyManagementService::class);
        $key = $kms->generateProjectKey($project, 'project', $user->id);
        $dek = $kms->getDecryptedKey($key);

        $encryption = app(EncryptionService::class);
        $encrypted = $encryption->encryptField('secret-value', $dek);
        $decrypted = $encryption->decryptField($encrypted, $dek);

        $this->assertSame('secret-value', $decrypted);
    }

    #[Test]
    public function it_rotates_keys_and_archives_previous(): void
    {
        $user = User::factory()->create();
        $project = SecureDbProject::create([
            'owner_id' => $user->id,
            'name' => 'Rotate Test',
            'api_key' => Str::random(32),
            'secret_key_hash' => Hash::make('secret'),
            'status' => 'active',
            'environment' => 'development',
            'encryption_mode' => 'field',
            'rotation_interval' => 'daily',
        ]);

        $kms = app(KeyManagementService::class);
        $old = $kms->generateProjectKey($project, 'project', $user->id);
        $new = $kms->rotateProjectKey($project, $user->id);

        $old->refresh();
        $this->assertSame('archived', $old->status);
        $this->assertSame('active', $new->status);
        $this->assertNotSame($old->uuid, $new->uuid);
    }
}
