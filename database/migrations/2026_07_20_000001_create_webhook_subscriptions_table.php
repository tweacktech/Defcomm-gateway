<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); // owner who registered it
            $table->string('name'); // human label, e.g. "Billing Service"
            $table->string('url');
            $table->string('secret'); // used to HMAC-sign delivered payloads
            $table->json('events'); // e.g. ["user.created","user.updated","user.deleted"] or ["*"]
            $table->boolean('is_active')->default(true);
            $table->dateTime('last_triggered_at')->nullable();
            $table->unsignedSmallInteger('last_response_status')->nullable();
            $table->unsignedInteger('failure_count')->default(0);
            $table->timestamps();

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_subscriptions');
    }
};
