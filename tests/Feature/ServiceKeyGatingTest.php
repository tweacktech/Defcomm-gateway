<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\OrganizationServiceKey;
use App\Models\Service;
use App\Models\User;
use App\Services\OrganizationServiceKeyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ServiceKeyGatingTest extends TestCase
{
    use RefreshDatabase;

    protected Organization $organization;

    protected User $user;

    protected string $clientId;

    protected string $clientSecret;

    protected function setUp(): void
    {
        parent::setUp();

        $this->clientId = 'test_client_'.bin2hex(random_bytes(4));
        $this->clientSecret = bin2hex(random_bytes(16));

        $this->organization = Organization::create([
            'name' => 'Test Org',
            'email' => 'org@example.com',
            'status' => 'active',
            'client_id' => $this->clientId,
            'client_secret' => Hash::make($this->clientSecret),
            'client_credentials_active' => true,
            'client_credentials_created_at' => now(),
        ]);

        $this->user = User::factory()->create([
            'organization_id' => $this->organization->id,
            'role' => 'admin',
            'status' => 'active',
        ]);

        foreach (['chat', 'vault', 'drive', 'meet', 'calls', 'files', 'translator'] as $key) {
            Service::query()->firstOrCreate(
                ['key' => $key],
                ['name' => ucfirst($key), 'is_active' => true],
            );
        }
    }

    protected function serviceHeaders(string $serviceKey, ?string $plainServiceKey = null): array
    {
        $headers = [
            'X-Client-Id' => $this->clientId,
            'X-Client-Secret' => $this->clientSecret,
            'Accept' => 'application/json',
        ];

        if ($plainServiceKey) {
            $headers['X-Service-Key'] = $plainServiceKey;
        }

        return $headers;
    }

    public function test_chat_requires_service_key(): void
    {
        Sanctum::actingAs($this->user);

        $this->getJson('/api/chat/conversations', $this->serviceHeaders('chat'))
            ->assertStatus(401)
            ->assertJsonFragment(['message' => 'Service API key required. Send X-Service-Key for this service.']);
    }

    public function test_chat_accepts_valid_service_key(): void
    {
        Sanctum::actingAs($this->user);

        $service = Service::query()->where('key', 'chat')->firstOrFail();
        $result = app(OrganizationServiceKeyService::class)->create($this->organization, $service, 'Test Chat Key', $this->user);

        $this->getJson('/api/chat/conversations', $this->serviceHeaders('chat', $result['plain_key']))
            ->assertOk();
    }

    public function test_wrong_service_key_is_rejected(): void
    {
        Sanctum::actingAs($this->user);

        $vault = Service::query()->where('key', 'vault')->firstOrFail();
        $result = app(OrganizationServiceKeyService::class)->create($this->organization, $vault, 'Vault Key', $this->user);

        $this->getJson('/api/chat/conversations', $this->serviceHeaders('chat', $result['plain_key']))
            ->assertStatus(403);
    }

    public function test_meet_route_is_under_api_meet_not_double_prefix(): void
    {
        Sanctum::actingAs($this->user);
        $service = Service::query()->where('key', 'meet')->firstOrFail();
        $result = app(OrganizationServiceKeyService::class)->create($this->organization, $service, 'Meet Key', $this->user);

        $this->getJson('/api/meet/rooms', $this->serviceHeaders('meet', $result['plain_key']))
            ->assertOk();

        $this->assertTrue(
            collect(\Illuminate\Support\Facades\Route::getRoutes())->contains(
                fn ($route) => $route->uri() === 'api/meet/rooms'
            )
        );
        $this->assertFalse(
            collect(\Illuminate\Support\Facades\Route::getRoutes())->contains(
                fn ($route) => $route->uri() === 'api/api/meet/rooms'
            )
        );
    }

    public function test_organization_can_create_service_key_via_api(): void
    {
        Sanctum::actingAs($this->user);

        $this->postJson('/api/organization/service-keys', [
            'service_key' => 'drive',
            'name' => 'Drive App',
        ], $this->serviceHeaders('drive'))
            ->assertCreated()
            ->assertJsonStructure(['plain_key', 'data' => ['uuid', 'service_key']]);

        $this->assertDatabaseHas('organization_service_keys', [
            'organization_id' => $this->organization->id,
            'name' => 'Drive App',
        ]);
    }
}
