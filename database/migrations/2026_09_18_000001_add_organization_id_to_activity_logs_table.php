<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('activity_logs', 'organization_id')) {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->unsignedBigInteger('organization_id')->nullable()->after('module');
                $table->index(['organization_id', 'created_at']);
            });
        }

        // Backfill from causer's current organization where possible.
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'organization_id')) {
            $userClass = \App\Models\User::class;

            DB::table('activity_logs as al')
                ->join('users as u', function ($join) use ($userClass) {
                    $join->on('al.causer_id', '=', 'u.id')
                        ->where('al.causer_type', '=', $userClass);
                })
                ->whereNull('al.organization_id')
                ->whereNotNull('u.organization_id')
                ->update(['al.organization_id' => DB::raw('u.organization_id')]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('activity_logs', 'organization_id')) {
            Schema::table('activity_logs', function (Blueprint $table) {
                $table->dropIndex(['organization_id', 'created_at']);
                $table->dropColumn('organization_id');
            });
        }
    }
};
