<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * activity_logs — a single append-only table that records every
     * significant action across the platform.
     *
     * Design decisions:
     *   - `causer_id` / `causer_type`  → polymorphic so any model (User, Admin)
     *     can be the actor without extra joins.
     *   - `subject_id` / `subject_type` → polymorphic so the target of the
     *     action can be any model (DriveItem, Service, VaultItem, etc.).
     *   - `properties` → JSON blob for arbitrary context (old/new values,
     *     file sizes, IP, etc.) without schema changes.
     *   - `event` → a short machine-readable verb: 'created', 'updated',
     *     'deleted', 'shared', 'transferred', 'uploaded', 'downloaded', etc.
     *   - `description` → human-readable sentence for display in the UI.
     *   - No soft deletes — logs are immutable by design.
     */
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();

            // Who performed the action
            $table->unsignedBigInteger('causer_id')->nullable();
            $table->string('causer_type')->nullable();   // e.g. App\Models\User

            // What was acted on (nullable for system-level events)
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('subject_type')->nullable();  // e.g. App\Models\DriveItem

            // Event classification
            $table->string('event');                     // machine-readable verb
            $table->string('description');               // human-readable sentence

            // Module / area of the app this event belongs to
            $table->string('module')->nullable();        // drive | vault | service | auth | …

            // Arbitrary context (IP, user-agent, old/new values, etc.)
            $table->json('properties')->nullable();

            $table->timestamp('created_at')->useCurrent();
            // No updated_at — logs are immutable

            // ── Indexes ───────────────────────────────────────────────────────
            $table->index(['causer_id', 'causer_type']);          // "my activity"
            $table->index(['subject_id', 'subject_type']);        // "activity on X"
            $table->index('event');                               // filter by verb
            $table->index('module');                              // filter by module
            $table->index('created_at');                         // time-range queries
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
