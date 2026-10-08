<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE `secure_db_encrypted_metadata` MODIFY `encryption_scope` ENUM('field', 'row', 'collection', 'document', 'table', 'database') NOT NULL");
        DB::statement("ALTER TABLE `secure_db_encryption_policies` MODIFY `scope` ENUM('field', 'row', 'collection', 'document', 'table', 'database') NOT NULL DEFAULT 'field'");
        DB::statement("ALTER TABLE `secure_db_notifications` MODIFY `type` ENUM('failed_decryption', 'unauthorized_access', 'connection_failure', 'rotation_failure', 'rotation_success', 'encryption_complete', 'encryption_completed', 'encryption_failed', 'general') NOT NULL");
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE `secure_db_encrypted_metadata` MODIFY `encryption_scope` ENUM('field', 'row', 'collection', 'document') NOT NULL");
        DB::statement("ALTER TABLE `secure_db_encryption_policies` MODIFY `scope` ENUM('field', 'row', 'collection', 'document') NOT NULL DEFAULT 'field'");
        DB::statement("ALTER TABLE `secure_db_notifications` MODIFY `type` ENUM('failed_decryption', 'unauthorized_access', 'connection_failure', 'rotation_failure', 'rotation_success', 'encryption_complete', 'general') NOT NULL");
    }
};
