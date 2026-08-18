<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('secure_db_connections', function (Blueprint $table) {
            if (! Schema::hasColumn('secure_db_connections', 'connection_timeout')) {
                $table->unsignedSmallInteger('connection_timeout')->default(10)->after('auto_reconnect');
            }
            if (! Schema::hasColumn('secure_db_connections', 'charset')) {
                $table->string('charset')->nullable()->after('connection_timeout');
            }
            if (! Schema::hasColumn('secure_db_connections', 'collation')) {
                $table->string('collation')->nullable()->after('charset');
            }
            if (! Schema::hasColumn('secure_db_connections', 'redis_database')) {
                $table->unsignedTinyInteger('redis_database')->default(0)->after('collation');
            }
            if (! Schema::hasColumn('secure_db_connections', 'connection_metadata')) {
                $table->json('connection_metadata')->nullable()->after('last_error');
            }
            if (! Schema::hasColumn('secure_db_connections', 'last_sync_at')) {
                $table->timestamp('last_sync_at')->nullable()->after('last_connected_at');
            }
            if (! Schema::hasColumn('secure_db_connections', 'table_count')) {
                $table->unsignedBigInteger('table_count')->default(0)->after('last_sync_at');
            }
            if (! Schema::hasColumn('secure_db_connections', 'record_count_estimate')) {
                $table->unsignedBigInteger('record_count_estimate')->default(0)->after('table_count');
            }
            if (! Schema::hasColumn('secure_db_connections', 'database_size_bytes')) {
                $table->unsignedBigInteger('database_size_bytes')->nullable()->after('record_count_estimate');
            }
        });

        if (! Schema::hasTable('secure_db_connection_schemas')) {
            Schema::create('secure_db_connection_schemas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('connection_id')->constrained('secure_db_connections')->cascadeOnDelete();
            $table->string('object_type', 32);
            $table->string('schema_name', 64)->nullable();
            $table->string('object_name', 64);
            $table->unsignedBigInteger('row_count_estimate')->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->json('columns_metadata')->nullable();
            $table->json('indexes_metadata')->nullable();
            $table->json('relations_metadata')->nullable();
            $table->json('encryption_fields')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
            $table->unique(['connection_id', 'object_type', 'schema_name', 'object_name'], 'sdb_conn_schema_unique');
            $table->index(['connection_id', 'object_type']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('secure_db_connection_schemas');

        Schema::table('secure_db_connections', function (Blueprint $table) {
            $table->dropColumn([
                'connection_timeout', 'charset', 'collation', 'redis_database',
                'connection_metadata', 'last_sync_at', 'table_count',
                'record_count_estimate', 'database_size_bytes',
            ]);
        });
    }
};
