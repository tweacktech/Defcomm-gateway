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
        Schema::create('file_shares', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('file_id')->nullable();
            $table->unsignedBigInteger('shared_by_user_id')->nullable();
            $table->unsignedBigInteger('shared_with_user_id')->nullable();
            $table->enum('permission', ['view', 'download', 'edit'])->default('view');
            $table->timestamp('expires_at')->nullable(); // link expiration
            $table->timestamp('accessed_at')->nullable(); // track access
            $table->timestamps();

            // Prevent duplicate shares
            $table->unique(['file_id', 'shared_with_user_id']);
            $table->index('shared_with_user_id');
            $table->index('created_at');
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('file_shares');
    }
};
