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
        Schema::create('chat_settings', function (Blueprint $table) {
            $table->id();
            $table->integer('user_id');
            $table->enum('is_online',['no','yes'])->default('no');
            $table->DateTime('last_seen')->nullable();
            $table->integer('hide_message')->nullable()->default(0);
            $table->enum('hide_message_style',['open_once','hold_open'])->nullable()->default('open_once');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_settings');
    }
};
