<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'company_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->unsignedBigInteger('company_id')->nullable()->after('organization_id')->index();
            });
        }

        // Link existing company users to the first admin in their organization.
        $admins = DB::table('users')
            ->where('role', 'admin')
            ->whereNotNull('organization_id')
            ->orderBy('id')
            ->get(['id', 'organization_id']);

        $adminByOrg = [];
        foreach ($admins as $admin) {
            $orgId = (int) $admin->organization_id;
            if (! isset($adminByOrg[$orgId])) {
                $adminByOrg[$orgId] = (int) $admin->id;
            }
        }

        foreach ($adminByOrg as $orgId => $adminId) {
            DB::table('users')
                ->where('organization_id', $orgId)
                ->where('role', 'user')
                ->whereNull('company_id')
                ->update(['company_id' => $adminId]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'company_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('company_id');
            });
        }
    }
};
