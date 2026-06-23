<?php

namespace Tests\Feature\SecureDB;

use App\Models\User;
use Database\Seeders\SecureDbSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SecureDbAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(SecureDbSeeder::class);
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    #[Test]
    public function guests_cannot_access_secure_db_dashboard(): void
    {
        $this->get('/admin/secure-db')->assertRedirect(route('login'));
    }

    #[Test]
    public function non_admin_users_are_forbidden(): void
    {
        $user = User::factory()->create(['role' => 'client']);
        $this->actingAs($user)->get('/admin/secure-db')->assertForbidden();
    }

    #[Test]
    public function admin_can_view_secure_db_dashboard(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin)->get('/admin/secure-db')->assertOk();
    }

    #[Test]
    public function admin_can_create_project(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $owner = User::factory()->create();

        $this->actingAs($admin)->post('/admin/secure-db/projects', [
            'name' => 'Test Project',
            'owner_id' => $owner->id,
            'environment' => 'development',
            'encryption_mode' => 'field',
            'rotation_interval' => 'daily',
        ])->assertRedirect();

        $this->assertDatabaseHas('secure_db_projects', ['name' => 'Test Project']);
    }
}
