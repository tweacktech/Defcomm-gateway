<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('secure_db_widget_app_keys', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('widget_id')->constrained('secure_db_widgets')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->string('name');
            $table->string('key_prefix', 16);
            $table->string('key_lookup', 64)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['widget_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('secure_db_widget_app_keys');
    }
};
