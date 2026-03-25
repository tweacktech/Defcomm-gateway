<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('meet_rooms', function (Blueprint $table) {
            $table->id();

            // ── Identity ──────────────────────────────────────────────────────
            $table->string('uid', 32)->unique();        // public room ID e.g. "abc-xyz-123"
            $table->string('name')->nullable();          // optional human-readable name
            $table->string('slug')->nullable()->unique(); // vanity URL e.g. /meet/my-standup

            // ── Ownership ─────────────────────────────────────────────────────
            $table->foreignId('owner_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // ── SDK / multi-tenant ────────────────────────────────────────────
            // null = internal Defcomm room, string = SDK consumer's app key
            $table->string('app_key')->nullable()->index();

            // ── Config ────────────────────────────────────────────────────────
            $table->string('password')->nullable();      // bcrypt, optional room lock
            $table->unsignedSmallInteger('max_participants')->default(50);
            $table->boolean('video_enabled')->default(true);
            $table->boolean('audio_enabled')->default(true);
            $table->boolean('chat_enabled')->default(true);
            $table->boolean('screen_share_enabled')->default(true);
            $table->boolean('recording_enabled')->default(false);
            $table->boolean('waiting_room')->default(false); // hold before admit
            $table->json('allowed_hosts')->nullable();   // domain whitelist for SDK embed

            // ── Lifecycle ─────────────────────────────────────────────────────
            $table->enum('status', ['scheduled', 'active', 'ended'])->default('scheduled');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable(); // filled on end

            // ── Webhooks (SDK feature) ─────────────────────────────────────────
            $table->string('webhook_url')->nullable();
            $table->json('webhook_events')->nullable();  // ['room.started','participant.joined']

            $table->timestamps();

            $table->index(['owner_id', 'status']);
            $table->index(['app_key', 'status']);
            $table->index('scheduled_at');
        });

        // ─── FILE 2: 2024_01_01_000011_create_meet_participants_table.php ─────

        Schema::create('meet_participants', function (Blueprint $table) {
            $table->id();

            $table->foreignId('room_id')
                ->constrained('meet_rooms')
                ->cascadeOnDelete();

            // null for unauthenticated SDK participants
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            // ── Identity (for guests / SDK) ───────────────────────────────────
            $table->string('display_name');
            $table->string('peer_id', 64)->unique();     // client-generated UUID
            $table->string('avatar_url')->nullable();

            // ── Role ─────────────────────────────────────────────────────────
            $table->enum('role', ['host', 'co-host', 'participant', 'viewer'])
                ->default('participant');

            // ── State ─────────────────────────────────────────────────────────
            $table->boolean('is_admitted')->default(true);   // false = waiting room
            $table->boolean('video_on')->default(false);
            $table->boolean('audio_on')->default(false);
            $table->boolean('screen_sharing')->default(false);
            $table->boolean('hand_raised')->default(false);

            // ── Connection ────────────────────────────────────────────────────
            $table->string('socket_id')->nullable();     // Reverb socket_id
            $table->timestamp('joined_at');
            $table->timestamp('left_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();

            $table->timestamps();

            $table->index(['room_id', 'left_at']);       // active participants
            $table->index(['room_id', 'user_id']);
            $table->index('peer_id');
        });

        // ─── FILE 3: 2024_01_01_000012_create_meet_recordings_table.php ──────

        Schema::create('meet_recordings', function (Blueprint $table) {
            $table->id();

            $table->foreignId('room_id')
                ->constrained('meet_rooms')
                ->cascadeOnDelete();

            $table->foreignId('initiated_by')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->string('disk')->default('local');
            $table->string('path')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            // $table->unsignedInteger('duration_seconds')->nullable();
            $table->integer('duration_seconds')->unsigned()->nullable();
            $table->enum('status', ['recording', 'processing', 'ready', 'failed'])
                ->default('recording');

            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('meet_recordings');
        Schema::dropIfExists('meet_participants');
        Schema::dropIfExists('meet_rooms');
    }
};
