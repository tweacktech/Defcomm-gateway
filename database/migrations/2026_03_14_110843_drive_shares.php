<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * drive_shares covers two distinct use-cases in one table:
     *
     *  1. SHARE LINK  (type = 'link')
     *     - token      → unique encrypted slug embedded in the URL
     *     - expires_at → optional expiry datetime
     *     - password   → optional bcrypt hash; caller must verify
     *     - max_uses   → optional cap; null = unlimited
     *     - use_count  → incremented on every access
     *     - recipient_id / transfer_* columns are NULL
     *
     *  2. TRANSFER    (type = 'transfer')
     *     - recipient_id → the user being offered ownership
     *     - transfer_status → pending | accepted | declined
     *     - accepted_at    → stamped when recipient accepts
     *     - token is still generated so the recipient gets a
     *       notification URL they can act on
     *     - expires_at / password / max_uses unused (nullable)
     */
    public function up(): void
    {
        Schema::create('drive_shares', function (Blueprint $table) {
            $table->id();

            $table->foreignId('drive_item_id')
                  ->constrained('drive_items')
                  ->cascadeOnDelete();

            $table->foreignId('owner_id')      // who created the share
                  ->constrained('users')
                  ->cascadeOnDelete();

            $table->enum('type', ['link', 'transfer']);

            // ── Share-link columns ────────────────────────────────────────────
            $table->string('token', 64)->unique();  // URL-safe encrypted slug
            $table->enum('permission', ['view', 'download'])
                  ->default('view');               // what the recipient can do
            $table->string('password')->nullable(); // bcrypt hash, optional
            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('use_count')->default(0);
            $table->timestamp('expires_at')->nullable();

            // ── Transfer columns ──────────────────────────────────────────────
            $table->foreignId('recipient_id')
                  ->nullable()
                  ->constrained('users')
                  ->nullOnDelete();

            $table->enum('transfer_status', ['pending', 'accepted', 'declined'])
                  ->nullable();

            $table->timestamp('accepted_at')->nullable();

            // ── Meta ──────────────────────────────────────────────────────────
            $table->boolean('is_active')->default(true);  // owner can revoke
            $table->timestamps();

            $table->index(['token']);
            $table->index(['drive_item_id', 'type']);
            $table->index(['recipient_id', 'transfer_status']);
            $table->index(['owner_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drive_shares');
    }
};
