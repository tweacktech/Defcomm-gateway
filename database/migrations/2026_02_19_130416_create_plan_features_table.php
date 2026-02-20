<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('plan_features', function (Blueprint $table) {
            $table->id();
            $table->integer('plan_id')->nullable();
            $table->integer('feature_id')->nullable();
            $table->unsignedBigInteger('limit')->nullable(); // null = unlimited
            $table->enum('period', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'lifetime'])->default('monthly');
            $table->json('metadata')->nullable(); // e.g. per-file-size, max-participants
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plan_features');
    }
};
