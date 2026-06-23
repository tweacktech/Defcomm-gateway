<?php

namespace Tests\Feature\SecureDB;

use App\Models\User;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Services\KeyManagementService;
use Database\Seeders\SecureDbSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SecureDbApiTest extends TestCase
{
    use RefreshDatabase;

    private SecureDbProject $project;
    private string $secret;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SecureDbSeeder::class);

        $admin = User::factory()->create(['role' => 'admin']);
        $this->secret = Str::random(64);

        $this->project = SecureDbProject::create([
            'owner_id' => $admin->id,
            'name' => 'API Project',
            'api_key' => Str::random(32),
            'secret_key_hash' => Hash::make($this->secret),
            'status' => 'active',
            'environment' => 'development',
            'encryption_mode' => 'field',
            'rotation_interval' => 'daily',
        ]);

        app(KeyManagementService::class)->generateProjectKey($this->project);
    }

    #[Test]
    public function api_requires_credentials(): void
    {
        $this->postJson('/api/secure-db/encrypt', ['value' => 'test'])->assertUnauthorized();
    }

    #[Test]
    public function api_can_encrypt_and_decrypt(): void
    {
        $headers = [
            'X-Secure-DB-Key' => $this->project->api_key,
            'X-Secure-DB-Secret' => $this->secret,
        ];

        $encrypt = $this->postJson('/api/secure-db/encrypt', ['value' => 'hello world'], $headers);
        $encrypt->assertOk();
        $encrypted = $encrypt->json('data.encrypted');

        $decrypt = $this->postJson('/api/secure-db/decrypt', ['value' => $encrypted], $headers);
        $decrypt->assertOk();
        $this->assertSame('hello world', $decrypt->json('data.decrypted'));
    }

    #[Test]
    public function api_status_returns_project_info(): void
    {
        $headers = [
            'X-Secure-DB-Key' => $this->project->api_key,
            'X-Secure-DB-Secret' => $this->secret,
        ];

        $this->getJson('/api/secure-db/status', $headers)
            ->assertOk()
            ->assertJsonPath('data.project.name', 'API Project');
    }
}
