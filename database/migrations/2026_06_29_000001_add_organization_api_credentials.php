<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('client_id')->nullable()->unique()->after('status');
            $table->string('client_secret')->nullable()->after('client_id');
            $table->boolean('client_credentials_active')->default(false)->after('client_secret');
            $table->timestamp('client_credentials_created_at')->nullable()->after('client_credentials_active');
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn([
                'client_id',
                'client_secret',
                'client_credentials_active',
                'client_credentials_created_at',
            ]);
        });
    }
};
