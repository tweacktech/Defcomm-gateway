<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('secure_db_widgets', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('connection_id')->constrained('secure_db_connections')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('widget_key', 64)->unique();
            $table->string('secret_key_hash');
            $table->string('language', 32)->default('javascript');
            $table->string('database_type', 32);
            $table->json('allowed_origins')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('access_count')->default(0);
            $table->timestamp('last_used_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['project_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('secure_db_widgets');
    }
};
