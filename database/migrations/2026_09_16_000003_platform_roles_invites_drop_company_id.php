<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'company_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('company_id');
            });
        }

        if (! Schema::hasColumn('users', 'platform_role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('platform_role', 40)->nullable()->after('role');
            });
        }

        // Existing supers become general_admin (main platform super).
        DB::table('users')
            ->where('role', 'super')
            ->whereNull('platform_role')
            ->update(['platform_role' => 'general_admin']);

        if (! Schema::hasTable('user_invitations')) {
            Schema::create('user_invitations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('organization_id')->nullable()->constrained('organizations')->nullOnDelete();
                $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('email');
                $table->string('role', 20)->default('user');
                $table->string('token', 64)->unique();
                $table->timestamp('expires_at');
                $table->timestamp('accepted_at')->nullable();
                $table->string('status', 20)->default('pending'); // pending|accepted|expired|revoked
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_invitations');

        if (Schema::hasColumn('users', 'platform_role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('platform_role');
            });
        }

        if (! Schema::hasColumn('users', 'company_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->unsignedBigInteger('company_id')->nullable()->after('organization_id')->index();
            });
        }
    }
};
