<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('secure_db_roles', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->json('permissions');
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('secure_db_projects', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('status', ['active', 'paused', 'suspended', 'archived'])->default('active');
            $table->enum('environment', ['development', 'staging', 'production'])->default('development');
            $table->string('api_key', 64)->unique();
            $table->string('secret_key_hash');
            $table->enum('encryption_mode', ['field', 'row', 'collection', 'document'])->default('field');
            $table->enum('rotation_interval', ['5_minutes', 'hourly', 'daily', 'weekly', 'custom'])->default('daily');
            $table->string('rotation_cron')->nullable();
            $table->string('default_algorithm')->default('aes-256-gcm');
            $table->json('allowed_ips')->nullable();
            $table->unsignedInteger('rate_limit_per_minute')->default(60);
            $table->unsignedBigInteger('encrypted_records_count')->default(0);
            $table->timestamp('last_rotation_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'environment']);
            $table->index('owner_id');
        });

        Schema::create('secure_db_project_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('role_id')->constrained('secure_db_roles')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['project_id', 'user_id']);
        });

        Schema::create('secure_db_connections', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->enum('database_type', ['mysql', 'postgresql', 'sqlserver', 'mariadb', 'mongodb', 'redis']);
            $table->string('host');
            $table->unsignedInteger('port');
            $table->string('database_name');
            $table->text('username_encrypted');
            $table->text('password_encrypted');
            $table->boolean('ssl_enabled')->default(false);
            $table->boolean('ssh_tunnel_enabled')->default(false);
            $table->json('ssh_config_encrypted')->nullable();
            $table->enum('health_status', ['healthy', 'degraded', 'unhealthy', 'unknown'])->default('unknown');
            $table->timestamp('last_health_check_at')->nullable();
            $table->timestamp('last_connected_at')->nullable();
            $table->text('last_error')->nullable();
            $table->boolean('auto_reconnect')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['project_id', 'health_status']);
        });

        Schema::create('secure_db_encryption_policies', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('connection_id')->nullable()->constrained('secure_db_connections')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->enum('scope', ['field', 'row', 'collection', 'document'])->default('field');
            $table->string('target_table')->nullable();
            $table->string('target_collection')->nullable();
            $table->json('sensitive_fields')->nullable();
            $table->string('algorithm')->default('aes-256-gcm');
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['project_id', 'is_active']);
        });

        Schema::create('secure_db_keys', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('key_type', ['master', 'client', 'project', 'session'])->default('project');
            $table->string('key_version')->default('1');
            $table->text('encrypted_key_material');
            $table->text('encrypted_dek')->nullable();
            $table->string('algorithm')->default('aes-256-gcm');
            $table->enum('status', ['active', 'rotating', 'archived', 'revoked'])->default('active');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('rotated_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['project_id', 'status', 'key_type']);
        });

        Schema::create('secure_db_devices', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('device_name');
            $table->string('fingerprint')->unique();
            $table->string('operating_system')->nullable();
            $table->string('browser')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('location')->nullable();
            $table->enum('status', ['pending', 'approved', 'revoked', 'blocked'])->default('pending');
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['project_id', 'status']);
        });

        Schema::create('secure_db_jobs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('connection_id')->nullable()->constrained('secure_db_connections')->nullOnDelete();
            $table->enum('job_type', ['encrypt', 'rotate', 'health_check', 'integrity_check', 'device_monitor', 'webhook']);
            $table->enum('status', ['pending', 'running', 'completed', 'failed', 'cancelled'])->default('pending');
            $table->json('payload')->nullable();
            $table->json('result')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'job_type', 'status']);
        });

        Schema::create('secure_db_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('connection_id')->nullable()->constrained('secure_db_connections')->nullOnDelete();
            $table->enum('level', ['debug', 'info', 'warning', 'error', 'critical'])->default('info');
            $table->string('event');
            $table->text('message');
            $table->json('context')->nullable();
            $table->timestamp('created_at');
            $table->index(['project_id', 'level', 'created_at']);
        });

        Schema::create('secure_db_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->nullable()->constrained('secure_db_projects')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('device_id')->nullable()->constrained('secure_db_devices')->nullOnDelete();
            $table->enum('action', [
                'login', 'encryption', 'decryption', 'key_rotation', 'database_access',
                'failed_access', 'device_change', 'project_change', 'connection_change',
                'policy_change', 'settings_change', 'api_access',
            ]);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->text('description');
            $table->json('metadata')->nullable();
            $table->boolean('success')->default(true);
            $table->timestamp('created_at');
            $table->index(['project_id', 'action', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('secure_db_rotation_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('old_key_id')->nullable()->constrained('secure_db_keys')->nullOnDelete();
            $table->foreignId('new_key_id')->nullable()->constrained('secure_db_keys')->nullOnDelete();
            $table->enum('status', ['started', 'completed', 'failed', 'rolled_back'])->default('started');
            $table->unsignedBigInteger('records_processed')->default(0);
            $table->unsignedBigInteger('records_failed')->default(0);
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->index(['project_id', 'status', 'started_at']);
        });

        Schema::create('secure_db_notifications', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->nullable()->constrained('secure_db_projects')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('channel', ['email', 'sms', 'in_app'])->default('in_app');
            $table->enum('type', [
                'failed_decryption', 'unauthorized_access', 'connection_failure',
                'rotation_failure', 'rotation_success', 'encryption_complete', 'general',
            ]);
            $table->string('title');
            $table->text('message');
            $table->json('metadata')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'is_read', 'created_at']);
        });

        Schema::create('secure_db_webhooks', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->string('url');
            $table->json('events');
            $table->string('secret_hash');
            $table->boolean('is_active')->default(true);
            $table->unsignedTinyInteger('max_retries')->default(3);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('secure_db_webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('webhook_id')->constrained('secure_db_webhooks')->cascadeOnDelete();
            $table->string('event');
            $table->json('payload');
            $table->enum('status', ['pending', 'delivered', 'failed'])->default('pending');
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->unsignedSmallInteger('response_code')->nullable();
            $table->text('response_body')->nullable();
            $table->timestamp('next_retry_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'next_retry_at']);
        });

        Schema::create('secure_db_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('secure_db_encrypted_metadata', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('project_id')->constrained('secure_db_projects')->cascadeOnDelete();
            $table->foreignId('connection_id')->constrained('secure_db_connections')->cascadeOnDelete();
            $table->foreignId('policy_id')->nullable()->constrained('secure_db_encryption_policies')->nullOnDelete();
            $table->foreignId('key_id')->nullable()->constrained('secure_db_keys')->nullOnDelete();
            $table->string('table_name')->nullable();
            $table->string('collection_name')->nullable();
            $table->string('record_identifier', 64);
            $table->string('field_name', 64)->nullable();
            $table->enum('encryption_scope', ['field', 'row', 'collection', 'document']);
            $table->string('algorithm');
            $table->string('key_version');
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'connection_id', 'table_name'], 'sdb_enc_meta_proj_conn_tbl_idx');
            $table->unique(['connection_id', 'record_identifier', 'field_name'], 'sdb_enc_meta_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('secure_db_encrypted_metadata');
        Schema::dropIfExists('secure_db_settings');
        Schema::dropIfExists('secure_db_webhook_deliveries');
        Schema::dropIfExists('secure_db_webhooks');
        Schema::dropIfExists('secure_db_notifications');
        Schema::dropIfExists('secure_db_rotation_logs');
        Schema::dropIfExists('secure_db_audit_logs');
        Schema::dropIfExists('secure_db_logs');
        Schema::dropIfExists('secure_db_jobs');
        Schema::dropIfExists('secure_db_devices');
        Schema::dropIfExists('secure_db_keys');
        Schema::dropIfExists('secure_db_encryption_policies');
        Schema::dropIfExists('secure_db_connections');
        Schema::dropIfExists('secure_db_project_user');
        Schema::dropIfExists('secure_db_projects');
        Schema::dropIfExists('secure_db_roles');
    }
};
