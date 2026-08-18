<?php

namespace Tests\Feature\SecureDB;

use App\Models\User;
use App\Modules\SecureDB\Jobs\EncryptConnectionDataJob;
use App\Modules\SecureDB\DTOs\ConnectionTestResult;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\DatabaseExplorerFactory;
use Database\Seeders\SecureDbSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Mockery;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ConnectionModuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SecureDbSeeder::class);
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    #[Test]
    public function admin_can_view_connections_page(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get('/admin/secure-db/connections')->assertOk();
    }

    #[Test]
    public function admin_can_create_connection_with_encrypted_credentials(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $project = $this->makeProject($admin);

        Queue::fake();
        $this->mockExplorerTest(true);

        $this->actingAs($admin)->post('/admin/secure-db/connections', [
            'project_id' => $project->id,
            'name' => 'Local MySQL',
            'database_type' => 'mysql',
            'host' => '127.0.0.1',
            'port' => 3306,
            'database_name' => 'testdb',
            'username' => 'root',
            'password' => 'secret',
            'connection_timeout' => 10,
            'charset' => 'utf8mb4',
        ])->assertRedirect();

        $connection = SecureDbConnection::first();
        $this->assertNotNull($connection);
        $this->assertSame('secret', Crypt::decryptString($connection->password_encrypted));
        $this->assertNotEquals('secret', $connection->password_encrypted);
    }

    #[Test]
    public function connection_test_returns_json_details(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $connection = $this->makeConnection($this->makeProject($admin));

        $this->mockExplorerTest(true, ping: 12.5, version: '8.0.36');

        $response = $this->actingAs($admin)
            ->postJson("/admin/secure-db/connections/{$connection->uuid}/api/test");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('driver', 'mysql');
    }

    #[Test]
    public function failed_connection_does_not_expose_password(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $connection = $this->makeConnection($this->makeProject($admin));

        $this->mockExplorerTest(false, message: 'Access denied for user root using password secret123');

        $response = $this->actingAs($admin)
            ->postJson("/admin/secure-db/connections/{$connection->uuid}/api/test");

        $response->assertOk()->assertJsonPath('success', false);
        $this->assertStringNotContainsString('secret123', $response->json('message') ?? '');
    }

    #[Test]
    public function non_admin_cannot_access_explorer(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        $connection = $this->makeConnection($this->makeProject(User::factory()->create(['role' => 'admin'])));

        $this->actingAs($user)
            ->get("/admin/secure-db/connections/{$connection->uuid}/explorer")
            ->assertForbidden();
    }

    #[Test]
    public function admin_can_queue_connection_encryption(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $connection = $this->makeConnection($this->makeProject($admin));
        $connection->update(['health_status' => 'healthy']);

        Queue::fake();

        $this->actingAs($admin)
            ->postJson("/admin/secure-db/connections/{$connection->uuid}/api/encrypt", [
                'scope' => 'field',
                'algorithm' => 'aes-256-gcm',
                'table_name' => 'users',
                'fields' => ['email'],
            ])
            ->assertOk()
            ->assertJsonPath('success', true);

        Queue::assertPushed(EncryptConnectionDataJob::class);
    }

    protected function makeProject(User $owner): SecureDbProject
    {
        return SecureDbProject::create([
            'owner_id' => $owner->id,
            'name' => 'Test Project',
            'api_key' => Str::random(32),
            'secret_key_hash' => Hash::make('secret'),
            'status' => 'active',
            'environment' => 'development',
            'encryption_mode' => 'field',
            'rotation_interval' => 'daily',
        ]);
    }

    protected function makeConnection(SecureDbProject $project): SecureDbConnection
    {
        return SecureDbConnection::create([
            'project_id' => $project->id,
            'name' => 'Test DB',
            'database_type' => 'mysql',
            'host' => '127.0.0.1',
            'port' => 3306,
            'database_name' => 'test',
            'username_encrypted' => Crypt::encryptString('root'),
            'password_encrypted' => Crypt::encryptString('pass'),
            'health_status' => 'unknown',
        ]);
    }

    protected function mockExplorerTest(bool $success, float $ping = 1.0, string $version = '8.0', ?string $message = null): void
    {
        $mockExplorer = Mockery::mock(\App\Modules\SecureDB\Contracts\DatabaseExplorerInterface::class);
        $mockExplorer->shouldReceive('test')->andReturn(new ConnectionTestResult(
            success: $success,
            status: $success ? 'connected' : 'failed',
            message: $message ?? ($success ? 'OK' : 'Failed'),
            pingMs: $ping,
            driver: 'mysql',
            serverVersion: $version,
            databaseVersion: $version,
            currentDatabase: 'test',
            characterEncoding: 'utf8mb4',
        ));

        $factory = Mockery::mock(DatabaseExplorerFactory::class);
        $factory->shouldReceive('for')->andReturn($mockExplorer);
        $this->app->instance(DatabaseExplorerFactory::class, $factory);
    }
}
