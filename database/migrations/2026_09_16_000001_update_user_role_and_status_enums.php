<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        // Widen columns so we can remap values safely.
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user'");
            DB::statement("ALTER TABLE users MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active'");
        }

        // Role: admin → super, company_admin → admin, client → user
        DB::table('users')->where('role', 'admin')->update(['role' => 'super']);
        DB::table('users')->where('role', 'company_admin')->update(['role' => 'admin']);
        DB::table('users')->where('role', 'client')->update(['role' => 'user']);

        // Status: inactive/suspended → block; keep active; introduce pending
        DB::table('users')->whereIn('status', ['inactive', 'suspended'])->update(['status' => 'block']);

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('user', 'admin', 'super') NOT NULL DEFAULT 'user'");
            DB::statement("ALTER TABLE users MODIFY COLUMN status ENUM('pending', 'active', 'block') NOT NULL DEFAULT 'active'");
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role VARCHAR(32) NOT NULL DEFAULT 'client'");
            DB::statement("ALTER TABLE users MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active'");
        }

        DB::table('users')->where('role', 'user')->update(['role' => 'client']);
        DB::table('users')->where('role', 'admin')->update(['role' => 'company_admin']);
        DB::table('users')->where('role', 'super')->update(['role' => 'admin']);
        DB::table('users')->where('status', 'block')->update(['status' => 'suspended']);
        DB::table('users')->where('status', 'pending')->update(['status' => 'inactive']);

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'company_admin', 'client') NOT NULL DEFAULT 'client'");
            DB::statement("ALTER TABLE users MODIFY COLUMN status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active'");
        }
    }
};
