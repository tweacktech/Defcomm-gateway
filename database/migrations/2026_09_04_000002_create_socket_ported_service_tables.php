<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('walkie_channels')) {
            Schema::create('walkie_channels', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('organization_id')->nullable()->constrained('organizations')->nullOnDelete();
                $table->string('name');
                $table->string('frequency')->nullable();
                $table->text('description')->nullable();
                $table->string('status', 20)->default('active');
                $table->timestamps();
                $table->unique(['user_id', 'name']);
            });
        }

        if (! Schema::hasTable('walkie_subscribers')) {
            Schema::create('walkie_subscribers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('channel_id')->constrained('walkie_channels')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('user_type', 20)->default('user');
                $table->string('status', 20)->default('pending');
                $table->timestamps();
                $table->unique(['channel_id', 'user_id']);
            });
        }

        if (! Schema::hasTable('walkie_recordings')) {
            Schema::create('walkie_recordings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('channel_id')->constrained('walkie_channels')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('subscriber_id')->nullable()->constrained('walkie_subscribers')->nullOnDelete();
                $table->string('path')->nullable();
                $table->string('record')->nullable();
                $table->text('record_text')->nullable();
                $table->unsignedBigInteger('file_size')->default(0);
                $table->string('file_ext', 20)->nullable();
                $table->string('source_language', 20)->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('walkie_subscriber_logs')) {
            Schema::create('walkie_subscriber_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('subscriber_id')->nullable()->constrained('walkie_subscribers')->nullOnDelete();
                $table->foreignId('channel_id')->constrained('walkie_channels')->cascadeOnDelete();
                $table->timestamp('leave_time')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('contact_lists')) {
            Schema::create('contact_lists', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('user_link')->constrained('users')->cascadeOnDelete();
                $table->string('status', 20)->default('active');
                $table->timestamps();
                $table->unique(['user_id', 'user_link']);
            });
        }

        if (! Schema::hasTable('organization_groups')) {
            Schema::create('organization_groups', function (Blueprint $table) {
                $table->id();
                $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('avatar')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('organization_group_users')) {
            Schema::create('organization_group_users', function (Blueprint $table) {
                $table->id();
                $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
                $table->foreignId('group_id')->constrained('organization_groups')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('join_date')->nullable();
                $table->string('status', 20)->default('pending');
                $table->string('hide', 10)->default('no');
                $table->timestamps();
                $table->unique(['group_id', 'user_id']);
            });
        }

        if (! Schema::hasTable('qr_login_requests')) {
            Schema::create('qr_login_requests', function (Blueprint $table) {
                $table->id();
                $table->uuid('code')->unique();
                $table->string('status', 20)->default('pending');
                $table->foreignId('approved_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('expires_at');
                $table->timestamp('approved_at')->nullable();
                $table->timestamp('redeemed_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('user_login_devices')) {
            Schema::create('user_login_devices', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('device_id')->nullable();
                $table->string('device_type')->nullable();
                $table->string('device_name')->nullable();
                $table->string('fcm_token')->nullable();
                $table->string('status', 20)->default('active');
                $table->timestamp('last_heartbeat_at')->nullable();
                $table->timestamps();
                $table->index(['user_id', 'device_id']);
            });
        }

        if (! Schema::hasTable('bounty_users')) {
            Schema::create('bounty_users', function (Blueprint $table) {
                $table->id();
                $table->string('first_name');
                $table->string('last_name');
                $table->string('username')->unique();
                $table->string('email')->unique();
                $table->string('password');
                $table->string('country')->nullable();
                $table->string('group_company')->nullable();
                $table->string('phone')->nullable();
                $table->string('otp', 10)->nullable();
                $table->string('zipcode')->nullable();
                $table->string('timezone')->nullable();
                $table->string('photo')->nullable();
                $table->text('bio')->nullable();
                $table->decimal('balance', 12, 2)->default(0);
                $table->string('user_type', 20)->default('user');
                $table->string('status', 20)->default('pending');
                $table->boolean('email_verified')->default(false);
                $table->rememberToken();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('bounty_programs')) {
            Schema::create('bounty_programs', function (Blueprint $table) {
                $table->id();
                $table->string('title');
                $table->text('detail')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('bounty_categories')) {
            Schema::create('bounty_categories', function (Blueprint $table) {
                $table->id();
                $table->string('label');
                $table->text('description')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('bounty_category_subs')) {
            Schema::create('bounty_category_subs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('category_id')->constrained('bounty_categories')->cascadeOnDelete();
                $table->string('label');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('bounty_reports')) {
            Schema::create('bounty_reports', function (Blueprint $table) {
                $table->id();
                $table->string('ref')->unique();
                $table->foreignId('bounty_user_id')->constrained('bounty_users')->cascadeOnDelete();
                $table->foreignId('program_id')->nullable()->constrained('bounty_programs')->nullOnDelete();
                $table->foreignId('category_id')->nullable()->constrained('bounty_categories')->nullOnDelete();
                $table->foreignId('category_sub_id')->nullable()->constrained('bounty_category_subs')->nullOnDelete();
                $table->string('title');
                $table->text('detail')->nullable();
                $table->string('severity')->nullable();
                $table->json('attachments')->nullable();
                $table->string('status', 20)->default('open');
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('event_forms')) {
            Schema::create('event_forms', function (Blueprint $table) {
                $table->id();
                $table->foreignId('organization_id')->nullable()->constrained('organizations')->nullOnDelete();
                $table->string('title');
                $table->text('description')->nullable();
                $table->timestamp('starts_at')->nullable();
                $table->timestamp('ends_at')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('event_registrations')) {
            Schema::create('event_registrations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('event_form_id')->constrained('event_forms')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('status', 20)->default('registered');
                $table->string('collection_status', 20)->nullable();
                $table->timestamps();
                $table->unique(['event_form_id', 'user_id']);
            });
        }

        if (! Schema::hasTable('event_attendances')) {
            Schema::create('event_attendances', function (Blueprint $table) {
                $table->id();
                $table->foreignId('event_form_id')->constrained('event_forms')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('clock_in_at')->nullable();
                $table->timestamp('clock_out_at')->nullable();
                $table->decimal('latitude', 10, 7)->nullable();
                $table->decimal('longitude', 10, 7)->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('certificates')) {
            Schema::create('certificates', function (Blueprint $table) {
                $table->id();
                $table->foreignId('event_form_id')->nullable()->constrained('event_forms')->nullOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('title');
                $table->string('code')->nullable();
                $table->string('file_path')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('souvenirs')) {
            Schema::create('souvenirs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('event_form_id')->nullable()->constrained('event_forms')->nullOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('title');
                $table->string('status', 20)->default('pending');
                $table->timestamps();
            });
        }

        if (! Schema::hasColumn('users', 'phone')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('phone')->nullable()->after('email');
            });
        }

        if (! Schema::hasColumn('users', 'fcm_token')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('fcm_token')->nullable()->after('remember_token');
                $table->string('device_token')->nullable()->after('fcm_token');
                $table->string('device_type')->nullable()->after('device_token');
                $table->boolean('is_online')->default(false)->after('device_type');
                $table->timestamp('last_heartbeat_at')->nullable()->after('is_online');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('souvenirs');
        Schema::dropIfExists('certificates');
        Schema::dropIfExists('event_attendances');
        Schema::dropIfExists('event_registrations');
        Schema::dropIfExists('event_forms');
        Schema::dropIfExists('bounty_reports');
        Schema::dropIfExists('bounty_category_subs');
        Schema::dropIfExists('bounty_categories');
        Schema::dropIfExists('bounty_programs');
        Schema::dropIfExists('bounty_users');
        Schema::dropIfExists('user_login_devices');
        Schema::dropIfExists('qr_login_requests');
        Schema::dropIfExists('organization_group_users');
        Schema::dropIfExists('organization_groups');
        Schema::dropIfExists('contact_lists');
        Schema::dropIfExists('walkie_subscriber_logs');
        Schema::dropIfExists('walkie_recordings');
        Schema::dropIfExists('walkie_subscribers');
        Schema::dropIfExists('walkie_channels');
    }
};
