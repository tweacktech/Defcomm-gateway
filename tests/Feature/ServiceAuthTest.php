<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ServiceAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_obtain_token_with_organization_credentials(): void
    {
        $plainSecret = bin2hex(random_bytes(16));

        $organization = Organization::factory()->create([
            'client_id' => 'test-client-id',
            'client_secret' => Hash::make($plainSecret),
            'client_credentials_active' => true,
        ]);

        $user = User::factory()->create([
            'organization_id' => $organization->id,
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/auth/token', [
            'email' => $user->email,
            'password' => 'password123',
        ], [
            'X-Client-Id' => 'test-client-id',
            'X-Client-Secret' => $plainSecret,
        ]);

        $response->assertOk()
            ->assertJsonStructure(['access_token', 'user', 'organization']);
    }

    public function test_authenticated_user_can_push_chat_message(): void
    {
        $plainSecret = bin2hex(random_bytes(16));

        $organization = Organization::factory()->create([
            'client_id' => 'org-client',
            'client_secret' => Hash::make($plainSecret),
            'client_credentials_active' => true,
        ]);

        $sender = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'active',
        ]);

        $recipient = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'active',
        ]);

        $token = $sender->createToken('test')->plainTextToken;

        $response = $this->postJson('/api/chat/push', [
            'recipient_id' => $recipient->id,
            'message' => 'Hello from API',
        ], [
            'X-Client-Id' => 'org-client',
            'X-Client-Secret' => $plainSecret,
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.message', 'Hello from API');

        $this->assertDatabaseHas('chat_messages', [
            'user_id' => $sender->id,
            'user_to' => $recipient->id,
        ]);
    }

    public function test_push_chat_rejects_cross_organization_recipient(): void
    {
        $plainSecret = bin2hex(random_bytes(16));

        $organization = Organization::factory()->create([
            'client_id' => 'org-client',
            'client_secret' => Hash::make($plainSecret),
            'client_credentials_active' => true,
        ]);

        $otherOrg = Organization::factory()->create();

        $sender = User::factory()->create([
            'organization_id' => $organization->id,
            'status' => 'active',
        ]);

        $recipient = User::factory()->create([
            'organization_id' => $otherOrg->id,
            'status' => 'active',
        ]);

        $token = $sender->createToken('test')->plainTextToken;

        $response = $this->postJson('/api/chat/push', [
            'recipient_id' => $recipient->id,
            'message' => 'Should fail',
        ], [
            'X-Client-Id' => 'org-client',
            'X-Client-Secret' => $plainSecret,
            'Authorization' => 'Bearer '.$token,
        ]);

        $response->assertUnprocessable();
    }
}
