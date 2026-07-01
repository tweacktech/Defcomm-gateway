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
        Schema::create('chat_last_logs', function (Blueprint $table) {
            $table->id();
            $table->integer('user_id');
            $table->integer('user_to');
            $table->string('group_to');
            $table->integer('chat_id');
            $table->enum('user_group',['user','group'])->default('user');
            $table->enum('is_file',['no','yes'])->default('no');
            $table->enum('is_typing',['no','yes'])->default('no');
            $table->enum('is_archive',['no','yes'])->default('no');
            $table->text('last_message')->nullable();
            $table->string('mss_type')->default('text');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_last_logs');
    }
};
