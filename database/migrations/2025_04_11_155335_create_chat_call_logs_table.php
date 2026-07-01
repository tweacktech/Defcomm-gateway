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
        Schema::create('chat_call_logs', function (Blueprint $table) {
            $table->id();
            $table->integer('send_user_id')->nullable();
            $table->integer('recieve_user_id')->nullable();
            $table->integer('call_st')->nullable();
            $table->integer('mss_id')->nullable();
            $table->string('call_duration')->nullable();
            $table->enum('call_state',['pick','miss', 'end'])->default('miss');
            $table->enum('chatbtw', ['user', 'group'])->default('user');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_call_logs');
    }
};
