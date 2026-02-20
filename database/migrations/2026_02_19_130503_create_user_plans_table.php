<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('user_plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->integer('file_size')->default(0);
            $table->integer('no_user')->default(0);
            $table->integer('no_group')->default(0);
            $table->enum('enable_chat', ['no', 'yes'])->default('no');
            $table->enum('enable_meeting', ['no', 'yes'])->default('no');
            $table->enum('enable_walkie', ['no', 'yes'])->default('no');
            $table->enum('enable_call', ['no', 'yes'])->default('no');
            $table->string('description')->nullable();
            $table->enum('status', ['active', 'block'])->default('active');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_plans');
    }
};
