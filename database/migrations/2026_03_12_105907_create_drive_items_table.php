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
        Schema::create('drive_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('drive_items')->cascadeOnDelete();
            $table->enum('type', ['folder', 'file']);
            $table->string('name');
            $table->string('mime_type')->nullable();          // e.g. image/png
            $table->string('disk')->default('local');         // local | s3 | etc.
            $table->string('path')->nullable();               // storage path for files
            $table->string('original_name')->nullable();      // original upload filename
            $table->unsignedBigInteger('size')->default(0);   // bytes
            $table->string('extension')->nullable();          // pdf, png, docx…
            $table->boolean('is_starred')->default(false);
            $table->softDeletes();                            // trash support
            $table->timestamps();

            $table->index(['user_id', 'parent_id', 'type']);
            $table->index(['user_id', 'is_starred']);
            $table->index(['user_id', 'deleted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('drive_items');
    }
};
