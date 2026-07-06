<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'plan_id')) {
                $table->unsignedBigInteger('plan_id')->nullable()->after('organization_id');
            }
            if (! Schema::hasColumn('users', 'subscription_active')) {
                $table->boolean('subscription_active')->default(true)->after('plan_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'subscription_active')) {
                $table->dropColumn('subscription_active');
            }
            if (Schema::hasColumn('users', 'plan_id')) {
                $table->dropColumn('plan_id');
            }
        });
    }
};
