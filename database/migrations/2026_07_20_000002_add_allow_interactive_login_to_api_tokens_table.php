<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_tokens', function (Blueprint $table) {
            // Default false: a regular integration token (e.g. one handed to
            // a billing service) must NOT be usable to open a full web
            // session. Only tokens explicitly minted for that purpose can.
            $table->boolean('allow_interactive_login')->default(false)->after('scopes');
        });
    }

    public function down(): void
    {
        Schema::table('api_tokens', function (Blueprint $table) {
            $table->dropColumn('allow_interactive_login');
        });
    }
};
