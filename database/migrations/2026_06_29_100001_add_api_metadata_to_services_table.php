<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->string('web_path')->nullable()->after('description');
            $table->string('api_base_path')->nullable()->after('web_path');
            $table->json('api_endpoints')->nullable()->after('api_base_path');
            $table->text('usage_notes')->nullable()->after('api_endpoints');
        });

        $defaults = [
            'translator' => [
                'web_path' => '/services/translator',
                'api_base_path' => '/api/client',
                'api_endpoints' => [
                    ['method' => 'POST', 'path' => '/api/client/translate-text', 'description' => 'Translate text', 'auth' => 'service'],
                    ['method' => 'POST', 'path' => '/api/client/translate-audio', 'description' => 'Translate audio', 'auth' => 'service'],
                    ['method' => 'POST', 'path' => '/api/client/text-translate-audio', 'description' => 'Text to translated audio', 'auth' => 'service'],
                ],
                'usage_notes' => 'Requires X-Client-Id, X-Client-Secret, and Authorization Bearer token.',
            ],
            'encryption' => [
                'web_path' => '/services/encryption',
                'api_base_path' => '/api',
                'api_endpoints' => [
                    ['method' => 'POST', 'path' => '/api/secure-db/encrypt', 'description' => 'Encrypt data', 'auth' => 'secure-db-key'],
                    ['method' => 'POST', 'path' => '/api/secure-db/decrypt', 'description' => 'Decrypt data', 'auth' => 'secure-db-key'],
                ],
                'usage_notes' => 'Secure DB uses project API key headers (X-Secure-DB-Key, X-Secure-DB-Secret).',
            ],
            'vault' => [
                'web_path' => '/services/vault',
                'api_base_path' => '/api/client/vault',
                'api_endpoints' => [
                    ['method' => 'GET', 'path' => '/api/client/vault', 'description' => 'List vault items', 'auth' => 'service'],
                    ['method' => 'POST', 'path' => '/api/client/vault', 'description' => 'Create vault item', 'auth' => 'service'],
                    ['method' => 'GET', 'path' => '/api/client/vault/{id}', 'description' => 'Get vault item', 'auth' => 'service'],
                    ['method' => 'PUT', 'path' => '/api/client/vault/{id}', 'description' => 'Update vault item', 'auth' => 'service'],
                    ['method' => 'DELETE', 'path' => '/api/client/vault/{id}', 'description' => 'Delete vault item', 'auth' => 'service'],
                ],
                'usage_notes' => 'Vault API requires organization credentials plus user bearer token.',
            ],
            'drive' => [
                'web_path' => '/services/drive',
                'api_base_path' => '/api/drive',
                'api_endpoints' => [
                    ['method' => 'GET', 'path' => '/api/drive', 'description' => 'List folder contents', 'auth' => 'sanctum'],
                    ['method' => 'POST', 'path' => '/api/drive/upload', 'description' => 'Upload files', 'auth' => 'sanctum'],
                    ['method' => 'POST', 'path' => '/api/drive/folders', 'description' => 'Create folder', 'auth' => 'sanctum'],
                    ['method' => 'GET', 'path' => '/api/drive/items/{id}/download', 'description' => 'Download file', 'auth' => 'sanctum'],
                ],
                'usage_notes' => 'Drive API uses Sanctum bearer token authentication.',
            ],
            'meet' => [
                'web_path' => '/meet',
                'api_base_path' => '/api/api/meet',
                'api_endpoints' => [
                    ['method' => 'GET', 'path' => '/api/api/meet/rooms', 'description' => 'List meeting rooms', 'auth' => 'sanctum'],
                    ['method' => 'POST', 'path' => '/api/api/meet/rooms', 'description' => 'Create meeting room', 'auth' => 'sanctum'],
                    ['method' => 'POST', 'path' => '/api/api/meet/rooms/{uid}/token', 'description' => 'Issue room token', 'auth' => 'sanctum'],
                ],
                'usage_notes' => 'Meet API uses Sanctum bearer token. Web UI available at /meet.',
            ],
            'chat' => [
                'web_path' => null,
                'api_base_path' => '/api/chat',
                'api_endpoints' => [
                    ['method' => 'POST', 'path' => '/api/chat/push', 'description' => 'Push message to user', 'auth' => 'service'],
                    ['method' => 'GET', 'path' => '/api/chat/messages', 'description' => 'Message history', 'auth' => 'service'],
                    ['method' => 'GET', 'path' => '/api/chat/conversations', 'description' => 'List conversations', 'auth' => 'service'],
                ],
                'usage_notes' => 'Chat push requires organization credentials plus user bearer token.',
            ],
        ];

        foreach ($defaults as $key => $data) {
            DB::table('services')->where('key', $key)->update([
                'web_path' => $data['web_path'],
                'api_base_path' => $data['api_base_path'],
                'api_endpoints' => json_encode($data['api_endpoints']),
                'usage_notes' => $data['usage_notes'],
                'updated_at' => now(),
            ]);
        }

        if (! DB::table('services')->where('key', 'chat')->exists()) {
            DB::table('services')->insert([
                'key' => 'chat',
                'name' => 'Chat',
                'description' => 'Push messages and manage conversations.',
                'web_path' => null,
                'api_base_path' => '/api/chat',
                'api_endpoints' => json_encode($defaults['chat']['api_endpoints']),
                'usage_notes' => $defaults['chat']['usage_notes'],
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn(['web_path', 'api_base_path', 'api_endpoints', 'usage_notes']);
        });
    }
};
