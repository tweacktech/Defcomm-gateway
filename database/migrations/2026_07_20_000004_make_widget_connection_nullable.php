<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('secure_db_widgets', function (Blueprint $table) {
            $table->dropForeign(['connection_id']);
        });

        Schema::table('secure_db_widgets', function (Blueprint $table) {
            $table->foreignId('connection_id')->nullable()->change();
            $table->foreign('connection_id')->references('id')->on('secure_db_connections')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('secure_db_widgets', function (Blueprint $table) {
            $table->dropForeign(['connection_id']);
        });

        Schema::table('secure_db_widgets', function (Blueprint $table) {
            $table->foreignId('connection_id')->nullable(false)->change();
            $table->foreign('connection_id')->references('id')->on('secure_db_connections')->cascadeOnDelete();
        });
    }
};
