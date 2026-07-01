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
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->integer('user_id');
            $table->integer('user_to');
            $table->string('group_to');
            $table->integer('reference_chat')->nullable();
            $table->string('mss_type')->default('text');
            $table->enum('user_group', ['user', 'group'])->default('user');
            $table->enum('is_file', ['no', 'yes'])->default('no');
            $table->enum('file_type', ['img', 'pdf', 'aud', 'vid', 'other'])->default('other');
            $table->enum('is_read', ['no', 'wait', 'yes'])->default('no');
            $table->enum('is_important', ['no', 'yes'])->default('no');
            $table->enum('is_forward', ['no', 'yes'])->default('no');
            $table->enum('is_star', ['no', 'yes'])->default('no');
            $table->enum('view_once', ['no', 'yes'])->default('no');
            $table->dateTime('expire_time')->nullable();
            $table->text('message')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
    }
};
