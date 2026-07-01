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
        Schema::create('files', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('name')->nullable(); // encrypted display name
            $table->text('filename_encrypted')->nullable(); // encrypted original filename (stored encrypted)
            $table->string('path')->nullable(); // storage path (encrypted filename on disk)
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size'); // in bytes (file size before encryption)
            $table->string('hash')->unique(); // for deduplication (hash of unencrypted content)
            $table->text('description')->nullable(); // encrypted description
            $table->enum('visibility', ['private', 'shared', 'public'])->default('private');
            $table->string('encryption_algorithm')->default('AES-256-CBC'); // encryption method used
            $table->boolean('is_encrypted')->default(true); // flag for encrypted files
            $table->softDeletes();
            $table->timestamps();

            $table->index('user_id');
            $table->index('visibility');
            $table->index('is_encrypted');
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('files');
    }
};
