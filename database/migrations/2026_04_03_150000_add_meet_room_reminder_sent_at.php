<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('meet_rooms', function (Blueprint $table) {
            $table->timestamp('reminder_sent_at')->nullable()->after('scheduled_at');
            $table->index('reminder_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('meet_rooms', function (Blueprint $table) {
            $table->dropIndex(['reminder_sent_at']);
            $table->dropColumn('reminder_sent_at');
        });
    }
};

