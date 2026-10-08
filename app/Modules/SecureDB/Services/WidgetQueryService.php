<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbWidget;
use App\Modules\SecureDB\Services\Explorers\AbstractSqlExplorer;
use RuntimeException;

class WidgetQueryService
{
    public function __construct(
        protected WidgetClientConnectionService $clientConnections,
        protected DatabaseExplorerFactory $explorers,
        protected DatabaseEncryptionService $encryption,
        protected EncryptionService $fieldEncryption,
        protected KeyManagementService $kms,
        protected AuditService $audit,
    ) {}

    public function connectionFor(SecureDbWidget $widget): SecureDbConnection
    {
        $connection = $this->clientConnections->latestForWidget($widget);
        if (! $connection) {
            throw new RuntimeException('Connect a database in the widget before querying.');
        }

        return $connection;
    }

    public function tables(SecureDbWidget $widget): array
    {
        $connection = $this->connectionFor($widget);
        $explorer = $this->explorers->for($connection);
        if (! $explorer instanceof AbstractSqlExplorer) {
            throw new RuntimeException('Query is supported for SQL databases only.');
        }

        $schema = $explorer->discoverSchema($connection);
        $encrypted = collect($this->encryption->listEncryptedObjects($connection))->keyBy('name');

        $tables = [];
        foreach ($schema['tables'] ?? [] as $table) {
            $name = is_array($table) ? ($table['name'] ?? null) : $table;
            if (! $name) {
                continue;
            }
            $meta = $encrypted->get($name);
            $tables[] = [
                'name' => $name,
                'encrypted' => $meta !== null,
                'encrypted_fields' => $meta['fields'] ?? $this->encryption->encryptedFieldsForTable($connection, $name),
                'algorithm' => $meta['algorithm'] ?? null,
            ];
        }

        return [
            'database' => $connection->database_name,
            'database_type' => $connection->database_type,
            'tables' => $tables,
        ];
    }

    public function query(SecureDbWidget $widget, array $params): array
    {
        $table = $params['table'];
        if (! preg_match('/^[A-Za-z0-9_]+$/', $table)) {
            throw new RuntimeException('Invalid table name.');
        }

        $connection = $this->connectionFor($widget);
        $explorer = $this->explorers->for($connection);
        if (! $explorer instanceof AbstractSqlExplorer) {
            throw new RuntimeException('Query is supported for SQL databases only.');
        }

        $page = max(1, (int) ($params['page'] ?? 1));
        $perPage = min(200, max(1, (int) ($params['per_page'] ?? 25)));
        $decrypt = true;
        if (array_key_exists('decrypt', $params) && $params['decrypt'] !== null) {
            $decrypt = filter_var($params['decrypt'], FILTER_VALIDATE_BOOLEAN);
        }

        $result = $explorer->browseData(
            $connection,
            $table,
            null,
            $page,
            $perPage,
            $params['sort_column'] ?? null,
            $params['sort_direction'] ?? 'asc',
            $params['search'] ?? null,
            $params['filter_column'] ?? null,
            $params['filter_value'] ?? null,
        );

        $rows = $result['rows'] ?? [];
        $encryption = [
            'encrypted' => false,
            'encrypted_fields' => $this->encryption->encryptedFieldsForTable($connection, $table),
            'algorithm' => null,
        ];

        if ($decrypt) {
            $decoded = $this->encryption->decryptResultSet($connection, $table, $rows);
            $rows = $decoded['rows'];
            $encryption = [
                'encrypted' => $decoded['encrypted'],
                'encrypted_fields' => $decoded['encrypted_fields'],
                'algorithm' => $decoded['algorithm'],
            ];
        } else {
            $encryption['encrypted'] = $encryption['encrypted_fields'] !== [];
        }

        $this->audit->log($widget->project, 'database_access', "App API queried {$table}", null, null, true, [
            'widget_id' => $widget->uuid,
            'table' => $table,
            'decrypted' => $decrypt,
        ]);

        return [
            'table' => $table,
            'rows' => $rows,
            'columns' => $result['columns'] ?? array_keys($rows[0] ?? []),
            'pagination' => $result['pagination'] ?? null,
            'encryption' => $encryption,
        ];
    }

    public function decryptValue(SecureDbWidget $widget, string $value): string
    {
        $project = $widget->project;
        $key = $project?->activeKey();
        if (! $key) {
            throw new RuntimeException('No active encryption key for this project.');
        }

        return $this->fieldEncryption->decryptField($value, $this->kms->getDecryptedKey($key));
    }
}
