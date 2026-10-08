<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_service_keys', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('service_id')->constrained('services')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('key_prefix', 16);
            $table->string('key_lookup', 64)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['organization_id', 'service_id', 'is_active'], 'org_service_keys_lookup_idx');
        });

        $now = now();
        $catalog = [
            ['key' => 'chat', 'name' => 'Chat', 'description' => 'Push and list chat messages via service API.', 'api_base_path' => '/api/chat'],
            ['key' => 'calls', 'name' => 'Audio Calls', 'description' => 'Audio call rooms, tokens, and participants.', 'api_base_path' => '/api/calls'],
            ['key' => 'files', 'name' => 'Files', 'description' => 'Encrypted file storage and sharing.', 'api_base_path' => '/api/files'],
            ['key' => 'walkie', 'name' => 'Walkie-Talkie', 'description' => 'Push-to-talk channels and broadcasts.', 'api_base_path' => '/api/walkie'],
            ['key' => 'contacts', 'name' => 'Contacts & Groups', 'description' => 'User contacts and organization groups.', 'api_base_path' => '/api/contacts'],
            ['key' => 'mobile_auth', 'name' => 'Mobile Auth', 'description' => 'OTP, QR login, devices, and heartbeat.', 'api_base_path' => '/api/mobile'],
            ['key' => 'bounty', 'name' => 'Bounty', 'description' => 'Bounty hunter registration and reports.', 'api_base_path' => '/api/bounty'],
            ['key' => 'events', 'name' => 'Events', 'description' => 'Event registration, certificates, and attendance.', 'api_base_path' => '/api/events'],
        ];

        foreach ($catalog as $row) {
            $exists = DB::table('services')->where('key', $row['key'])->exists();
            if ($exists) {
                continue;
            }
            DB::table('services')->insert([
                'key' => $row['key'],
                'name' => $row['name'],
                'description' => $row['description'],
                'api_base_path' => $row['api_base_path'],
                'usage_notes' => 'Requires X-Client-Id, X-Client-Secret, Authorization Bearer, and X-Service-Key.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('services')
            ->whereIn('key', ['translator', 'encryption', 'vault', 'drive', 'meet', 'chat'])
            ->update([
                'usage_notes' => 'Requires X-Client-Id, X-Client-Secret, Authorization Bearer, and X-Service-Key.',
                'updated_at' => $now,
            ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_service_keys');
    }
};
