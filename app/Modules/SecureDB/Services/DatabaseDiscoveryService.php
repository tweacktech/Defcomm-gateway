<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbConnectionSchema;
use Illuminate\Support\Facades\DB;

class DatabaseDiscoveryService
{
    public function __construct(
        protected DatabaseExplorerFactory $explorers,
    ) {}

    public function sync(SecureDbConnection $connection): array
    {
        $explorer = $this->explorers->for($connection);
        $schema = $explorer->discoverSchema($connection);

        DB::transaction(function () use ($connection, $explorer, $schema) {
            SecureDbConnectionSchema::where('connection_id', $connection->id)->delete();

            $tableCount = 0;
            $recordEstimate = 0;
            $sizeBytes = 0;

            if (in_array($connection->database_type, ['mysql', 'mariadb', 'postgresql', 'sqlserver'], true)) {
                $tables = array_slice($schema['tables'] ?? [], 0, 500);
                foreach ($tables as $table) {
                    $meta = $explorer->getObjectMetadata($connection, $table['name']);
                    SecureDbConnectionSchema::create([
                        'connection_id' => $connection->id,
                        'object_type' => 'table',
                        'schema_name' => $connection->database_name ?: '',
                        'object_name' => $table['name'],
                        'row_count_estimate' => $table['row_count'] ?? 0,
                        'size_bytes' => $table['size_bytes'] ?? 0,
                        'columns_metadata' => $meta['columns'] ?? [],
                        'indexes_metadata' => $meta['indexes'] ?? [],
                        'relations_metadata' => $meta['relations'] ?? [],
                        'encryption_fields' => $meta['encryption'] ?? [],
                        'synced_at' => now(),
                    ]);
                    $tableCount++;
                    $recordEstimate += (int) ($table['row_count'] ?? 0);
                    $sizeBytes += (int) ($table['size_bytes'] ?? 0);
                }

                foreach (['views', 'procedures', 'functions', 'triggers'] as $type) {
                    foreach ($schema[$type] ?? [] as $obj) {
                        SecureDbConnectionSchema::create([
                            'connection_id' => $connection->id,
                            'object_type' => rtrim($type, 's'),
                            'schema_name' => $connection->database_name ?: '',
                            'object_name' => $obj['name'],
                            'synced_at' => now(),
                        ]);
                    }
                }
            } elseif ($connection->database_type === 'mongodb') {
                foreach ($schema['collections'] ?? [] as $col) {
                    SecureDbConnectionSchema::create([
                        'connection_id' => $connection->id,
                        'object_type' => 'collection',
                        'object_name' => $col['name'],
                        'row_count_estimate' => $col['document_count'] ?? 0,
                        'indexes_metadata' => $col['indexes'] ?? [],
                        'synced_at' => now(),
                    ]);
                    $tableCount++;
                    $recordEstimate += (int) ($col['document_count'] ?? 0);
                }
            } elseif ($connection->database_type === 'redis') {
                foreach ($schema['keys'] ?? [] as $key) {
                    SecureDbConnectionSchema::create([
                        'connection_id' => $connection->id,
                        'object_type' => 'key',
                        'object_name' => $key['name'],
                        'columns_metadata' => ['type' => $key['type'], 'ttl' => $key['ttl']],
                        'synced_at' => now(),
                    ]);
                    $tableCount++;
                }
                $sizeBytes = (int) ($schema['memory_used_bytes'] ?? 0);
            }

            $connection->update([
                'last_sync_at' => now(),
                'table_count' => $tableCount,
                'record_count_estimate' => $recordEstimate,
                'database_size_bytes' => $sizeBytes ?: $connection->database_size_bytes,
            ]);
        });

        return $schema;
    }
}
