<?php

namespace Tests\Feature\SecureDB;

use App\Models\User;
use App\Modules\SecureDB\DTOs\ConnectionTestResult;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Models\SecureDbWidget;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\WidgetService;
use Database\Seeders\SecureDbSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Mockery;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SecureWidgetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SecureDbSeeder::class);
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    #[Test]
    public function admin_can_view_secure_widget_page(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get('/admin/secure-db/secure-widget')->assertOk();
    }

    #[Test]
    public function admin_can_create_widget_with_database_market_type(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $project = $this->makeProject($admin);

        $this->actingAs($admin)->post('/admin/secure-db/widgets', [
            'project_id' => $project->id,
            'database_type' => 'mysql',
            'name' => 'Portal Widget',
            'language' => 'javascript',
        ])->assertRedirect();

        $this->assertDatabaseHas('secure_db_widgets', [
            'name' => 'Portal Widget',
            'language' => 'javascript',
            'database_type' => 'mysql',
            'connection_id' => null,
        ]);
    }

    #[Test]
    public function widget_api_authenticates_with_secret(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $project = $this->makeProject($admin);

        $service = app(WidgetService::class);
        $result = $service->create($project, 'Test', 'php', 'mysql', $admin->id);

        $response = $this->postJson('/api/secure-db/widget/authenticate', [
            'widget_key' => $result['widget']->widget_key,
            'secret_key' => $result['secret_key'],
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'widget', 'algorithms', 'requires_client_connection'])
            ->assertJsonPath('requires_client_connection', true)
            ->assertJsonPath('widget.database_type', 'mysql');
    }

    #[Test]
    public function widget_rejects_invalid_secret(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $project = $this->makeProject($admin);

        $widget = SecureDbWidget::create([
            'project_id' => $project->id,
            'connection_id' => null,
            'name' => 'W',
            'widget_key' => 'wdg_test123',
            'secret_key_hash' => Hash::make('correct'),
            'language' => 'javascript',
            'database_type' => 'mysql',
        ]);

        $this->postJson('/api/secure-db/widget/authenticate', [
            'widget_key' => $widget->widget_key,
            'secret_key' => 'wrong',
        ])->assertUnauthorized();
    }

    #[Test]
    public function widget_can_connect_client_database(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $project = $this->makeProject($admin);

        $service = app(WidgetService::class);
        $result = $service->create($project, 'Client Widget', 'javascript', 'mysql', $admin->id);

        $auth = $this->postJson('/api/secure-db/widget/authenticate', [
            'widget_key' => $result['widget']->widget_key,
            'secret_key' => $result['secret_key'],
        ])->assertOk();

        $token = $auth->json('token');

        $mock = Mockery::mock(ConnectionService::class)->makePartial();
        $mock->shouldReceive('encryptCredentials')->andReturn([
            'username_encrypted' => Crypt::encryptString('root'),
            'password_encrypted' => Crypt::encryptString('pass'),
        ]);
        $mock->shouldReceive('testConnectionDetailed')->andReturn(new ConnectionTestResult(
            success: true,
            status: 'healthy',
            message: 'Connected',
            pingMs: 12,
            serverVersion: '8.0.0',
            driver: 'mysql',
        ));
        $this->app->instance(ConnectionService::class, $mock);

        $response = $this->withHeader('X-Widget-Token', $token)->postJson('/api/secure-db/widget/connect', [
            'host' => '127.0.0.1',
            'port' => 3306,
            'database_name' => 'client_db',
            'username' => 'root',
            'password' => 'secret',
            'ssl_enabled' => false,
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('connection.host', '127.0.0.1')
            ->assertJsonPath('connection.database_name', 'client_db');

        $this->withHeader('X-Widget-Token', $token)
            ->getJson('/api/secure-db/widget/connection-status')
            ->assertOk()
            ->assertJsonPath('connected', true);
    }

    protected function makeProject(User $owner): SecureDbProject
    {
        return SecureDbProject::create([
            'owner_id' => $owner->id,
            'name' => 'Widget Project',
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
            'name' => 'Widget DB',
            'database_type' => 'mysql',
            'host' => '127.0.0.1',
            'port' => 3306,
            'database_name' => 'test',
            'username_encrypted' => Crypt::encryptString('root'),
            'password_encrypted' => Crypt::encryptString('pass'),
            'health_status' => 'healthy',
        ]);
    }
}
