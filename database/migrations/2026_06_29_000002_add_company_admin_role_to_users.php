<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'company_admin', 'client') NOT NULL DEFAULT 'client'");

            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('client')->change();
        });
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'company_admin')->update(['role' => 'client']);

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'client') NOT NULL DEFAULT 'client'");
        }
    }
};
