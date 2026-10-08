<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_forms', function (Blueprint $table) {
            if (! Schema::hasColumn('event_forms', 'message')) {
                $table->longText('message')->nullable()->after('description');
            }
            if (! Schema::hasColumn('event_forms', 'group_id')) {
                $table->foreignId('group_id')->nullable()->after('organization_id')
                    ->constrained('organization_groups')->nullOnDelete();
            }
            if (! Schema::hasColumn('event_forms', 'meet_room_id')) {
                $table->unsignedBigInteger('meet_room_id')->nullable()->after('group_id');
            }
            if (! Schema::hasColumn('event_forms', 'signup')) {
                $table->string('signup', 20)->default('disabled')->after('is_active');
            }
            if (! Schema::hasColumn('event_forms', 'attendance')) {
                $table->string('attendance', 20)->default('disabled')->after('signup');
            }
            if (! Schema::hasColumn('event_forms', 'status')) {
                $table->string('status', 20)->default('active')->after('attendance');
            }
            if (! Schema::hasColumn('event_forms', 'location')) {
                $table->string('location')->nullable()->after('ends_at');
            }
            if (! Schema::hasColumn('event_forms', 'latitude')) {
                $table->string('latitude')->nullable()->after('location');
            }
            if (! Schema::hasColumn('event_forms', 'longitude')) {
                $table->string('longitude')->nullable()->after('latitude');
            }
            if (! Schema::hasColumn('event_forms', 'timezone')) {
                $table->string('timezone')->nullable()->after('longitude');
            }
            if (! Schema::hasColumn('event_forms', 'form_type')) {
                $table->string('form_type')->nullable()->after('title');
            }
            if (! Schema::hasColumn('event_forms', 'created_by')) {
                $table->foreignId('created_by')->nullable()->after('organization_id')
                    ->constrained('users')->nullOnDelete();
            }
        });

        Schema::table('event_registrations', function (Blueprint $table) {
            if (! Schema::hasColumn('event_registrations', 'name')) {
                $table->string('name')->nullable()->after('user_id');
            }
            if (! Schema::hasColumn('event_registrations', 'email')) {
                $table->string('email')->nullable()->after('name');
            }
            if (! Schema::hasColumn('event_registrations', 'phone')) {
                $table->string('phone')->nullable()->after('email');
            }
            if (! Schema::hasColumn('event_registrations', 'data')) {
                $table->json('data')->nullable()->after('phone');
            }
        });

        Schema::table('event_attendances', function (Blueprint $table) {
            if (! Schema::hasColumn('event_attendances', 'comment')) {
                $table->string('comment')->nullable()->after('longitude');
            }
            if (! Schema::hasColumn('event_attendances', 'location')) {
                $table->string('location')->nullable()->after('comment');
            }
            if (! Schema::hasColumn('event_attendances', 'timezone')) {
                $table->string('timezone')->nullable()->after('location');
            }
        });

        Schema::table('certificates', function (Blueprint $table) {
            if (! Schema::hasColumn('certificates', 'status')) {
                $table->string('status', 20)->default('active')->after('file_path');
            }
            if (! Schema::hasColumn('certificates', 'template')) {
                $table->string('template')->nullable()->after('title');
            }
        });

        // Allow form-level certificate templates (socket parity).
        try {
            Schema::table('certificates', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
            });
        } catch (\Throwable) {
            // Foreign key name may differ.
        }
        \Illuminate\Support\Facades\DB::statement('ALTER TABLE `certificates` MODIFY `user_id` BIGINT UNSIGNED NULL');

        Schema::table('souvenirs', function (Blueprint $table) {
            if (! Schema::hasColumn('souvenirs', 'image')) {
                $table->string('image')->nullable()->after('title');
            }
        });

        try {
            Schema::table('souvenirs', function (Blueprint $table) {
                $table->dropForeign(['user_id']);
            });
        } catch (\Throwable) {
        }
        \Illuminate\Support\Facades\DB::statement('ALTER TABLE `souvenirs` MODIFY `user_id` BIGINT UNSIGNED NULL');

        if (! Schema::hasTable('certificate_registrations')) {
            Schema::create('certificate_registrations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('certificate_id')->constrained('certificates')->cascadeOnDelete();
                $table->foreignId('event_registration_id')->constrained('event_registrations')->cascadeOnDelete();
                $table->boolean('is_collected')->default(false);
                $table->boolean('is_sent')->default(false);
                $table->timestamps();
                $table->unique(['certificate_id', 'event_registration_id'], 'cert_reg_unique');
            });
        }

        if (! Schema::hasTable('souvenir_registrations')) {
            Schema::create('souvenir_registrations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('souvenir_id')->constrained('souvenirs')->cascadeOnDelete();
                $table->foreignId('event_registration_id')->constrained('event_registrations')->cascadeOnDelete();
                $table->boolean('is_collected')->default(false);
                $table->timestamps();
                $table->unique(['souvenir_id', 'event_registration_id'], 'souvenir_reg_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('souvenir_registrations');
        Schema::dropIfExists('certificate_registrations');

        Schema::table('souvenirs', function (Blueprint $table) {
            if (Schema::hasColumn('souvenirs', 'image')) {
                $table->dropColumn('image');
            }
        });

        Schema::table('certificates', function (Blueprint $table) {
            foreach (['status', 'template'] as $col) {
                if (Schema::hasColumn('certificates', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('event_attendances', function (Blueprint $table) {
            foreach (['comment', 'location', 'timezone'] as $col) {
                if (Schema::hasColumn('event_attendances', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('event_registrations', function (Blueprint $table) {
            foreach (['name', 'email', 'phone', 'data'] as $col) {
                if (Schema::hasColumn('event_registrations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('event_forms', function (Blueprint $table) {
            foreach ([
                'message', 'meet_room_id', 'signup', 'attendance', 'status',
                'location', 'latitude', 'longitude', 'timezone', 'form_type',
            ] as $col) {
                if (Schema::hasColumn('event_forms', $col)) {
                    $table->dropColumn($col);
                }
            }
            if (Schema::hasColumn('event_forms', 'group_id')) {
                $table->dropConstrainedForeignId('group_id');
            }
            if (Schema::hasColumn('event_forms', 'created_by')) {
                $table->dropConstrainedForeignId('created_by');
            }
        });
    }
};
