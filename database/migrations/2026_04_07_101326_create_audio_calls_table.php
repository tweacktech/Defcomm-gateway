<?php
// database/migrations/2024_01_02_000001_create_audio_calls_tables.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // ── audio_calls ────────────────────────────────────────────────────────
        Schema::create('audio_calls', function (Blueprint $table) {
            $table->id();
            $table->string('uid', 36)->unique();           // public-facing ID (e.g. ac-xxxx-yyyy)
            $table->string('title')->nullable();           // optional call label
            $table->foreignId('initiator_id')->constrained('users')->cascadeOnDelete();
            $table->string('app_key')->nullable();         // SDK app_key for external calls

            // ── Priority ──────────────────────────────────────────────────────
            // routine   — normal, can be declined
            // important — ring with visual flag, logged
            // urgent    — overrides DND, auto-answers after timeout
            // emergency — bypasses all restrictions, cannot be declined
            $table->enum('priority', ['routine', 'important', 'urgent', 'emergency'])
                  ->default('routine');
            $table->text('priority_note')->nullable();     // context: "Security breach — call now"

            // ── Mode ──────────────────────────────────────────────────────────
            // one_to_one — direct call between two users
            // group      — multi-participant audio conference
            $table->enum('mode', ['one_to_one', 'group'])->default('one_to_one');

            // ── Targeting ─────────────────────────────────────────────────────
            $table->foreignId('callee_id')->nullable()->constrained('users')->nullOnDelete();  // one_to_one only
            $table->integer('max_participants')->default(50);

            // ── Security ──────────────────────────────────────────────────────
            $table->string('password')->nullable();        // hashed
            $table->boolean('waiting_room')->default(false);
            $table->boolean('mute_on_join')->default(true);
            $table->boolean('record_enabled')->default(false);

            // ── Lifecycle ─────────────────────────────────────────────────────
            // pending   — initiated, ringing
            // active    — at least one participant connected
            // on_hold   — host placed the call on hold
            // ended     — terminated
            // missed    — callee never answered (one_to_one only)
            // declined  — callee explicitly declined (one_to_one only)
            $table->enum('status', ['pending', 'active', 'on_hold', 'ended', 'missed', 'declined'])
                  ->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();

            // ── SDK / Webhooks ─────────────────────────────────────────────────
            $table->string('webhook_url')->nullable();
            $table->json('webhook_events')->nullable();

            $table->timestamps();

            $table->index(['status', 'priority']);
            $table->index(['initiator_id', 'created_at']);
            $table->index(['callee_id', 'status']);
        });

        // ── audio_call_participants ─────────────────────────────────────────────
        Schema::create('audio_call_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('call_id')->constrained('audio_calls')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('peer_id', 36);                 // WebRTC peer UUID
            $table->string('display_name');
            $table->string('avatar_url')->nullable();
            $table->enum('role', ['host', 'participant'])->default('participant');
            $table->boolean('is_admitted')->default(true);
            $table->boolean('audio_on')->default(false);
            $table->boolean('hand_raised')->default(false);
            $table->boolean('is_muted_by_host')->default(false);
            $table->enum('status', ['ringing', 'joined', 'left', 'declined', 'missed', 'kicked'])
                  ->default('ringing');
            $table->timestamp('joined_at')->nullable();
            $table->timestamp('left_at')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->timestamps();

            $table->unique(['call_id', 'peer_id']);
            $table->index(['call_id', 'status']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audio_call_participants');
        Schema::dropIfExists('audio_calls');
    }
};