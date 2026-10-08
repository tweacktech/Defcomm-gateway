<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbEncryptedMetadata;
use App\Modules\SecureDB\Models\SecureDbEncryptionPolicy;
use App\Modules\SecureDB\Models\SecureDbKey;
use App\Modules\SecureDB\Services\Explorers\AbstractSqlExplorer;
use RuntimeException;

class DatabaseEncryptionService
{
    private const ENCRYPTABLE_TYPES = [
        'varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext',
        'json', 'blob', 'tinyblob', 'mediumblob', 'longblob',
        'nvarchar', 'nchar', 'ntext', 'string',
    ];

    public function __construct(
        protected DatabaseExplorerFactory $explorers,
        protected EncryptionService $encryption,
        protected KeyManagementService $kms,
    ) {}

    public static function supportedAlgorithms(): array
    {
        return [
            EncryptionService::AES_256_GCM => 'AES-256-GCM',
            EncryptionService::CHACHA20_POLY1305 => 'ChaCha20-Poly1305',
            EncryptionService::RSA_HYBRID => 'RSA-4096 Hybrid',
        ];
    }

    /**
     * @return array{processed: int, tables: int, fields: array<string>}
     */
    public function encrypt(
        SecureDbConnection $connection,
        string $scope,
        string $algorithm,
        ?string $tableName = null,
        array $fields = [],
        ?callable $onProgress = null,
    ): array {
        $this->assertAlgorithm($algorithm);

        $explorer = $this->explorers->for($connection);
        if (! $explorer instanceof AbstractSqlExplorer) {
            throw new RuntimeException('Encryption is supported for SQL database connections only.');
        }

        if ($connection->health_status !== 'healthy') {
            throw new RuntimeException('Connection must be healthy before encryption can run.');
        }

        $project = $connection->project;
        if (! $project) {
            throw new RuntimeException('Connection is not linked to a project.');
        }

        $key = $project->activeKey() ?? $this->kms->generateProjectKey($project);
        $dek = $this->kms->getDecryptedKey($key);

        $tables = $this->resolveTables($explorer, $connection, $scope, $tableName);
        $processed = 0;
        $scanned = 0;
        $encryptedFields = [];
        $totalRows = $this->countRows($explorer, $connection, $tables);
        $this->reportProgress($onProgress, 0, $scanned, $totalRows, $tables[0] ?? null, 'Starting encryption…');

        foreach ($tables as $table) {
            $meta = $explorer->getObjectMetadata($connection, $table);
            $targetFields = $this->resolveFields($meta['columns'] ?? [], $scope, $fields);
            if ($targetFields === []) {
                continue;
            }

            $pkColumn = $this->resolvePrimaryKey($meta['columns'] ?? []);
            if (! $pkColumn) {
                continue;
            }

            $page = 1;
            do {
                $batch = $explorer->browseData($connection, $table, null, $page, 100, $pkColumn, 'asc');
                foreach ($batch['rows'] as $row) {
                    $scanned++;
                    $updates = [];
                    foreach ($targetFields as $field) {
                        if (! array_key_exists($field, $row) || $row[$field] === null || $row[$field] === '') {
                            continue;
                        }
                        $value = (string) $row[$field];
                        if ($this->isAlreadyEncrypted($value)) {
                            continue;
                        }
                        $updates[$field] = $this->encryption->encryptField($value, $dek, $algorithm);
                        $encryptedFields[$field] = true;
                    }

                    if ($updates !== []) {
                        $explorer->updateRowFields($connection, $table, $pkColumn, $row[$pkColumn], $updates);
                        $processed += count($updates);

                        foreach (array_keys($updates) as $field) {
                            $this->recordMetadata($connection, $key, $table, (string) $row[$pkColumn], $field, $algorithm, $scope);
                        }
                    }

                    $this->reportProgress($onProgress, $this->percent($scanned, $totalRows), $scanned, $totalRows, $table, "Encrypting {$table}…");
                }
                $page++;
            } while ($page <= ($batch['pagination']['last_page'] ?? 1));

            $this->upsertPolicy($connection, $scope, $table, array_keys($encryptedFields), $algorithm);
        }

        $project->increment('encrypted_records_count', $processed);
        $this->reportProgress($onProgress, 100, $scanned, $totalRows, null, 'Encryption complete.');

        return [
            'processed' => $processed,
            'tables' => count($tables),
            'fields' => array_keys($encryptedFields),
            'algorithm' => $algorithm,
        ];
    }

    /**
     * @return array{processed: int, tables: int, fields: array<string>}
     */
    public function decrypt(
        SecureDbConnection $connection,
        string $scope,
        ?string $tableName = null,
        ?callable $onProgress = null,
    ): array {
        $explorer = $this->explorers->for($connection);
        if (! $explorer instanceof AbstractSqlExplorer) {
            throw new RuntimeException('Decryption is supported for SQL database connections only.');
        }

        if ($connection->health_status !== 'healthy') {
            throw new RuntimeException('Connection must be healthy before decryption can run.');
        }

        $project = $connection->project;
        if (! $project) {
            throw new RuntimeException('Connection is not linked to a project.');
        }

        $key = $project->activeKey();
        if (! $key) {
            throw new RuntimeException('No active encryption key for this project.');
        }
        $dek = $this->kms->getDecryptedKey($key);

        $tables = $tableName
            ? [$tableName]
            : $this->encryptedTableNames($connection);

        if ($tables === []) {
            throw new RuntimeException('No encrypted tables or collections were found.');
        }

        $processed = 0;
        $scanned = 0;
        $decryptedFields = [];
        $totalRows = $this->countRows($explorer, $connection, $tables);
        $this->reportProgress($onProgress, 0, $scanned, $totalRows, $tables[0] ?? null, 'Starting decryption…');

        foreach ($tables as $table) {
            $meta = $explorer->getObjectMetadata($connection, $table);
            $pkColumn = $this->resolvePrimaryKey($meta['columns'] ?? []);
            if (! $pkColumn) {
                continue;
            }

            $targetFields = SecureDbEncryptedMetadata::query()
                ->where('connection_id', $connection->id)
                ->where('table_name', $table)
                ->whereNotNull('field_name')
                ->distinct()
                ->pluck('field_name')
                ->all();

            if ($targetFields === []) {
                $targetFields = array_column($meta['columns'] ?? [], 'name');
            }

            $page = 1;
            do {
                $batch = $explorer->browseData($connection, $table, null, $page, 100, $pkColumn, 'asc');
                foreach ($batch['rows'] as $row) {
                    $scanned++;
                    $updates = [];
                    foreach ($targetFields as $field) {
                        if (! array_key_exists($field, $row) || $row[$field] === null || $row[$field] === '') {
                            continue;
                        }
                        $value = (string) $row[$field];
                        if (! $this->isAlreadyEncrypted($value)) {
                            continue;
                        }
                        $updates[$field] = $this->encryption->decryptField($value, $dek);
                        $decryptedFields[$field] = true;
                    }

                    if ($updates !== []) {
                        $explorer->updateRowFields($connection, $table, $pkColumn, $row[$pkColumn], $updates);
                        $processed += count($updates);
                    }

                    $this->reportProgress($onProgress, $this->percent($scanned, $totalRows), $scanned, $totalRows, $table, "Decrypting {$table}…");
                }
                $page++;
            } while ($page <= ($batch['pagination']['last_page'] ?? 1));

            SecureDbEncryptedMetadata::query()
                ->where('connection_id', $connection->id)
                ->where('table_name', $table)
                ->delete();
        }

        $this->reportProgress($onProgress, 100, $scanned, $totalRows, null, 'Decryption complete.');

        return [
            'processed' => $processed,
            'tables' => count($tables),
            'fields' => array_keys($decryptedFields),
            'algorithm' => $key->algorithm,
        ];
    }

    public function listEncryptedObjects(SecureDbConnection $connection): array
    {
        return SecureDbEncryptedMetadata::query()
            ->where('connection_id', $connection->id)
            ->get()
            ->groupBy(fn (SecureDbEncryptedMetadata $row) => $row->table_name ?: $row->collection_name ?: 'unknown')
            ->map(function ($rows, $name) {
                $first = $rows->first();

                return [
                    'name' => $name,
                    'object_type' => $first?->table_name ? 'table' : 'collection',
                    'encryption_scope' => $first?->encryption_scope,
                    'algorithm' => $first?->algorithm,
                    'encrypted_values' => $rows->count(),
                    'fields' => $rows->pluck('field_name')->unique()->filter()->values()->all(),
                    'last_encrypted_at' => optional($rows->sortByDesc('updated_at')->first())->updated_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Decrypt encrypted fields in a query result without writing back to the database.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{rows: array<int, array<string, mixed>>, encrypted: bool, encrypted_fields: array<int, string>, algorithm: ?string}
     */
    public function decryptResultSet(SecureDbConnection $connection, string $table, array $rows): array
    {
        $knownFields = $this->encryptedFieldsForTable($connection, $table);
        $project = $connection->project;
        $key = $project?->activeKey();
        $dek = $key ? $this->kms->getDecryptedKey($key) : null;
        $decryptedFields = [];
        $algorithm = $key?->algorithm;

        foreach ($rows as $index => $row) {
            foreach ($row as $field => $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                $string = is_scalar($value) ? (string) $value : '';
                if ($string === '' || ! $this->isAlreadyEncrypted($string)) {
                    continue;
                }
                if (! $dek) {
                    throw new RuntimeException('No active encryption key is available to decrypt this table.');
                }
                try {
                    $rows[$index][$field] = $this->encryption->decryptField($string, $dek);
                    $decryptedFields[$field] = true;
                } catch (\Throwable) {
                    // Leave the original value if this cell is not actually decryptable.
                }
            }
        }

        return [
            'rows' => $rows,
            'encrypted' => $knownFields !== [] || $decryptedFields !== [],
            'encrypted_fields' => array_values(array_unique(array_merge($knownFields, array_keys($decryptedFields)))),
            'algorithm' => $algorithm,
        ];
    }

    public function encryptedFieldsForTable(SecureDbConnection $connection, string $table): array
    {
        $fromMeta = SecureDbEncryptedMetadata::query()
            ->where('connection_id', $connection->id)
            ->where('table_name', $table)
            ->whereNotNull('field_name')
            ->distinct()
            ->pluck('field_name')
            ->all();

        $fromPolicy = SecureDbEncryptionPolicy::query()
            ->where('connection_id', $connection->id)
            ->where('is_active', true)
            ->where(function ($q) use ($table) {
                $q->where('target_table', $table)->orWhere('target_collection', $table);
            })
            ->get()
            ->flatMap(fn (SecureDbEncryptionPolicy $policy) => $policy->sensitive_fields ?? [])
            ->all();

        return array_values(array_unique(array_filter([...$fromMeta, ...$fromPolicy])));
    }

    protected function resolveTables(AbstractSqlExplorer $explorer, SecureDbConnection $connection, string $scope, ?string $tableName): array
    {
        return match ($scope) {
            'database' => array_slice(
                array_column($explorer->discoverSchema($connection)['tables'] ?? [], 'name'),
                0,
                200,
            ),
            'table', 'field' => $tableName ? [$tableName] : throw new RuntimeException('Table name is required.'),
            default => throw new RuntimeException("Invalid encryption scope: {$scope}"),
        };
    }

    protected function resolveFields(array $columns, string $scope, array $requestedFields): array
    {
        if ($scope === 'field') {
            if ($requestedFields === []) {
                throw new RuntimeException('At least one field must be selected for field encryption.');
            }

            $valid = array_column($columns, 'name');

            return array_values(array_intersect($requestedFields, $valid));
        }

        $fields = [];
        foreach ($columns as $column) {
            $type = strtolower((string) ($column['type'] ?? ''));
            if (! in_array($type, self::ENCRYPTABLE_TYPES, true)) {
                continue;
            }
            if (! empty($column['primary_key']) && ! empty($column['auto_increment'])) {
                continue;
            }
            $fields[] = $column['name'];
        }

        return $fields;
    }

    protected function resolvePrimaryKey(array $columns): ?string
    {
        foreach ($columns as $column) {
            if (! empty($column['primary_key'])) {
                return $column['name'];
            }
        }

        return $columns[0]['name'] ?? null;
    }

    protected function isAlreadyEncrypted(string $value): bool
    {
        if (strlen($value) < 16) {
            return false;
        }

        $decoded = json_decode(base64_decode($value, true) ?: '', true);

        return is_array($decoded) && isset($decoded['ciphertext'], $decoded['algorithm']);
    }

    protected function upsertPolicy(
        SecureDbConnection $connection,
        string $scope,
        string $table,
        array $fields,
        string $algorithm,
    ): void {
        if ($fields === []) {
            return;
        }

        $policy = SecureDbEncryptionPolicy::firstOrNew([
            'connection_id' => $connection->id,
            'target_table' => $table,
            'scope' => $scope === 'database' ? 'field' : $scope,
        ]);

        $policy->fill([
            'project_id' => $connection->project_id,
            'name' => "Auto policy: {$table}",
            'target_collection' => null,
            'sensitive_fields' => array_values(array_unique(array_merge($policy->sensitive_fields ?? [], $fields))),
            'algorithm' => $algorithm,
            'is_active' => true,
        ]);
        $policy->save();
    }

    protected function recordMetadata(
        SecureDbConnection $connection,
        SecureDbKey $key,
        string $table,
        string $recordId,
        string $field,
        string $algorithm,
        string $scope,
    ): void {
        SecureDbEncryptedMetadata::updateOrCreate(
            [
                'connection_id' => $connection->id,
                'table_name' => $table,
                'record_identifier' => substr($recordId, 0, 64),
                'field_name' => substr($field, 0, 64),
            ],
            [
                'project_id' => $connection->project_id,
                'key_id' => $key->id,
                'encryption_scope' => $scope,
                'algorithm' => $algorithm,
                'key_version' => $key->key_version,
            ],
        );
    }

    protected function encryptedTableNames(SecureDbConnection $connection): array
    {
        return SecureDbEncryptedMetadata::query()
            ->where('connection_id', $connection->id)
            ->whereNotNull('table_name')
            ->distinct()
            ->pluck('table_name')
            ->all();
    }

    protected function countRows(AbstractSqlExplorer $explorer, SecureDbConnection $connection, array $tables): int
    {
        $total = 0;
        foreach ($tables as $table) {
            $batch = $explorer->browseData($connection, $table, null, 1, 1);
            $total += (int) ($batch['pagination']['total'] ?? 0);
        }

        return max($total, 1);
    }

    protected function percent(int $scanned, int $total): int
    {
        return (int) min(99, max(0, floor(($scanned / max($total, 1)) * 100)));
    }

    protected function reportProgress(?callable $onProgress, int $percent, int $processed, int $total, ?string $table, string $message): void
    {
        if (! $onProgress) {
            return;
        }

        $onProgress([
            'percent' => $percent,
            'processed' => $processed,
            'total' => $total,
            'table' => $table,
            'message' => $message,
        ]);
    }

    protected function assertAlgorithm(string $algorithm): void
    {
        if (! array_key_exists($algorithm, self::supportedAlgorithms())) {
            throw new RuntimeException("Unsupported algorithm: {$algorithm}");
        }
    }
}
