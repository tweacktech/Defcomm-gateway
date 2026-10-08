<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('portal_notifications')) {
            Schema::create('portal_notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('organization_id')->nullable()->constrained('organizations')->nullOnDelete();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('title');
                $table->text('body')->nullable();
                $table->string('audience', 40)->default('all'); // all|super|company|client
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('languages')) {
            Schema::create('languages', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code', 20)->unique();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('statement_agreements')) {
            Schema::create('statement_agreements', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->string('slug')->nullable();
                $table->longText('content')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('system_mails')) {
            Schema::create('system_mails', function (Blueprint $table) {
                $table->id();
                $table->string('key')->unique();
                $table->string('subject');
                $table->longText('body')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('contact_submissions')) {
            Schema::create('contact_submissions', function (Blueprint $table) {
                $table->id();
                $table->string('name')->nullable();
                $table->string('email')->nullable();
                $table->string('phone')->nullable();
                $table->string('subject')->nullable();
                $table->text('message')->nullable();
                $table->string('status', 20)->default('new');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('contact_bookings')) {
            Schema::create('contact_bookings', function (Blueprint $table) {
                $table->id();
                $table->string('name')->nullable();
                $table->string('email')->nullable();
                $table->string('phone')->nullable();
                $table->string('company')->nullable();
                $table->timestamp('preferred_at')->nullable();
                $table->text('notes')->nullable();
                $table->string('status', 20)->default('new');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('app_stores')) {
            Schema::create('app_stores', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('name');
                $table->string('package')->nullable();
                $table->string('platform', 40)->nullable();
                $table->string('version')->nullable();
                $table->string('status', 20)->default('pending');
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('app_stores');
        Schema::dropIfExists('contact_bookings');
        Schema::dropIfExists('contact_submissions');
        Schema::dropIfExists('system_mails');
        Schema::dropIfExists('statement_agreements');
        Schema::dropIfExists('languages');
        Schema::dropIfExists('portal_notifications');
    }
};
