<?php

namespace App\Modules\SecureDB\Services\Explorers;

use App\Modules\SecureDB\Contracts\DatabaseExplorerInterface;
use App\Modules\SecureDB\DTOs\ConnectionTestResult;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\EncryptionFieldService;
use PDO;
use RuntimeException;

abstract class AbstractSqlExplorer implements DatabaseExplorerInterface
{
    public function __construct(
        protected ConnectionService $connections,
        protected EncryptionFieldService $encryptionFields,
    ) {}

    abstract protected function driverName(): string;

    abstract protected function connect(SecureDbConnection $connection): PDO;

    public function test(SecureDbConnection $connection): ConnectionTestResult
    {
        $start = microtime(true);

        try {
            $pdo = $this->connect($connection);
            $pdo->query('SELECT 1');
            $version = $this->fetchServerVersion($pdo);
            $encoding = $this->fetchEncoding($pdo, $connection);

            return new ConnectionTestResult(
                success: true,
                status: 'connected',
                message: 'Connection established successfully.',
                pingMs: round((microtime(true) - $start) * 1000, 2),
                driver: $this->driverName(),
                serverVersion: $version,
                databaseVersion: $version,
                currentDatabase: $connection->database_name,
                characterEncoding: $encoding,
            );
        } catch (\Throwable $e) {
            return new ConnectionTestResult(
                success: false,
                status: 'failed',
                message: $this->sanitizeError($e->getMessage()),
                pingMs: round((microtime(true) - $start) * 1000, 2),
                driver: $this->driverName(),
            );
        }
    }

    public function discoverSchema(SecureDbConnection $connection): array
    {
        $pdo = $this->connect($connection);

        return [
            'schemas' => $this->listSchemas($pdo, $connection),
            'tables' => $this->listTables($pdo, $connection),
            'views' => $this->listViews($pdo, $connection),
            'procedures' => $this->listProcedures($pdo, $connection),
            'functions' => $this->listFunctions($pdo, $connection),
            'triggers' => $this->listTriggers($pdo, $connection),
        ];
    }

    public function getObjectMetadata(SecureDbConnection $connection, string $objectName, ?string $schemaName = null): array
    {
        $pdo = $this->connect($connection);
        $columns = $this->describeColumns($pdo, $connection, $objectName, $schemaName);
        $indexes = $this->describeIndexes($pdo, $connection, $objectName, $schemaName);
        $relations = $this->describeForeignKeys($pdo, $connection, $objectName, $schemaName);
        $rowCount = $this->estimateRowCount($pdo, $connection, $objectName, $schemaName);
        $encryption = $this->encryptionFields->forTable($connection, $objectName);

        return [
            'name' => $objectName,
            'schema' => $schemaName,
            'columns' => $columns,
            'indexes' => $indexes,
            'relations' => $relations,
            'row_count' => $rowCount,
            'encryption' => $encryption,
        ];
    }

    public function browseData(
        SecureDbConnection $connection,
        string $objectName,
        ?string $schemaName = null,
        int $page = 1,
        int $perPage = 50,
        ?string $sortColumn = null,
        string $sortDirection = 'asc',
        ?string $search = null,
        ?string $filterColumn = null,
        ?string $filterValue = null,
    ): array {
        $pdo = $this->connect($connection);
        $perPage = min(max($perPage, 1), 200);
        $page = max($page, 1);
        $offset = ($page - 1) * $perPage;

        $qualified = $this->qualifyTable($objectName, $schemaName);
        $columns = array_column($this->describeColumns($pdo, $connection, $objectName, $schemaName), 'name');

        $where = [];
        $params = [];

        if ($filterColumn && $filterValue !== null && $filterValue !== '' && in_array($filterColumn, $columns, true)) {
            $where[] = $this->quoteIdentifier($filterColumn) . ' = ?';
            $params[] = $filterValue;
        }

        if ($search && $columns) {
            $searchParts = [];
            foreach (array_slice($columns, 0, 8) as $col) {
                $searchParts[] = 'CAST(' . $this->quoteIdentifier($col) . ' AS CHAR) LIKE ?';
                $params[] = '%' . $search . '%';
            }
            if ($searchParts) {
                $where[] = '(' . implode(' OR ', $searchParts) . ')';
            }
        }

        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $orderSql = '';
        if ($sortColumn && in_array($sortColumn, $columns, true)) {
            $dir = strtolower($sortDirection) === 'desc' ? 'DESC' : 'ASC';
            $orderSql = 'ORDER BY ' . $this->quoteIdentifier($sortColumn) . ' ' . $dir;
        }

        $countSql = "SELECT COUNT(*) FROM {$qualified} {$whereSql}";
        $stmt = $pdo->prepare($countSql);
        $stmt->execute($params);
        $total = (int) $stmt->fetchColumn();

        $dataSql = "SELECT * FROM {$qualified} {$whereSql} {$orderSql} LIMIT {$perPage} OFFSET {$offset}";
        $stmt = $pdo->prepare($dataSql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $encryption = $this->encryptionFields->forTable($connection, $objectName);

        return [
            'columns' => $columns,
            'rows' => $rows,
            'pagination' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => (int) ceil($total / $perPage),
            ],
            'encryption' => $encryption,
        ];
    }

    public function exportData(
        SecureDbConnection $connection,
        string $objectName,
        ?string $schemaName = null,
        array $selectedIds = [],
        int $limit = 1000,
    ): array {
        $pdo = $this->connect($connection);
        $qualified = $this->qualifyTable($objectName, $schemaName);
        $pk = $this->primaryKeyColumn($pdo, $connection, $objectName, $schemaName);

        if ($selectedIds && $pk) {
            $placeholders = implode(',', array_fill(0, count($selectedIds), '?'));
            $sql = "SELECT * FROM {$qualified} WHERE {$this->quoteIdentifier($pk)} IN ({$placeholders}) LIMIT {$limit}";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($selectedIds);
        } else {
            $sql = "SELECT * FROM {$qualified} LIMIT {$limit}";
            $stmt = $pdo->query($sql);
        }

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function updateRowFields(
        SecureDbConnection $connection,
        string $table,
        string $pkColumn,
        mixed $pkValue,
        array $fieldValues,
    ): void {
        if ($fieldValues === []) {
            return;
        }

        $pdo = $this->connect($connection);
        $qualified = $this->qualifyTable($table, null);
        $sets = [];
        $params = [];

        foreach ($fieldValues as $column => $value) {
            $sets[] = $this->quoteIdentifier($column) . ' = ?';
            $params[] = $value;
        }

        $params[] = $pkValue;
        $sql = 'UPDATE ' . $qualified . ' SET ' . implode(', ', $sets)
            . ' WHERE ' . $this->quoteIdentifier($pkColumn) . ' = ?';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }

    abstract protected function fetchServerVersion(PDO $pdo): string;

    abstract protected function fetchEncoding(PDO $pdo, SecureDbConnection $connection): ?string;

    abstract protected function listSchemas(PDO $pdo, SecureDbConnection $connection): array;

    abstract protected function listTables(PDO $pdo, SecureDbConnection $connection): array;

    abstract protected function listViews(PDO $pdo, SecureDbConnection $connection): array;

    abstract protected function listProcedures(PDO $pdo, SecureDbConnection $connection): array;

    abstract protected function listFunctions(PDO $pdo, SecureDbConnection $connection): array;

    abstract protected function listTriggers(PDO $pdo, SecureDbConnection $connection): array;

    abstract protected function describeColumns(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array;

    abstract protected function describeIndexes(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array;

    abstract protected function describeForeignKeys(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array;

    abstract protected function estimateRowCount(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): int;

    abstract protected function qualifyTable(string $table, ?string $schema): string;

    abstract protected function quoteIdentifier(string $identifier): string;

    abstract protected function primaryKeyColumn(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): ?string;

    protected function sanitizeError(string $message): string
    {
        $message = preg_replace('/\busing password\s+\S+/i', 'using password [redacted]', $message) ?? $message;
        $message = preg_replace('/password[=:\s][^\s;\)]*/i', 'password [redacted]', $message) ?? $message;

        return preg_replace('/:\/\/[^:]+:[^@]+@/', '://[redacted]:[redacted]@', $message) ?? $message;
    }
}
