<?php

namespace App\Modules\SecureDB\Services\Explorers;

use App\Modules\SecureDB\Models\SecureDbConnection;
use PDO;

class SqlServerExplorer extends AbstractSqlExplorer
{
    protected function driverName(): string
    {
        return 'sqlsrv';
    }

    protected function connect(SecureDbConnection $connection): PDO
    {
        $pdo = $this->connections->connect($connection);
        if (! $pdo instanceof PDO) {
            throw new \RuntimeException('Expected PDO connection.');
        }

        return $pdo;
    }

    protected function fetchServerVersion(PDO $pdo): string
    {
        return (string) $pdo->query('SELECT @@VERSION')->fetchColumn();
    }

    protected function fetchEncoding(PDO $pdo, SecureDbConnection $connection): ?string
    {
        return (string) $pdo->query('SELECT DATABASEPROPERTYEX(DB_NAME(), \'Collation\')')->fetchColumn() ?: null;
    }

    protected function listSchemas(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query('SELECT name FROM sys.schemas ORDER BY name');

        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'name');
    }

    protected function listTables(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query(
            "SELECT t.name, p.rows AS row_count, SUM(a.total_pages) * 8 * 1024 AS size_bytes
             FROM sys.tables t
             INNER JOIN sys.partitions p ON t.object_id = p.object_id
             INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
             WHERE p.index_id IN (0,1)
             GROUP BY t.name, p.rows ORDER BY t.name"
        );

        return array_map(fn ($r) => [
            'name' => $r['name'],
            'type' => 'table',
            'row_count' => (int) $r['row_count'],
            'size_bytes' => (int) ($r['size_bytes'] ?? 0),
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listViews(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query('SELECT name FROM sys.views ORDER BY name');

        return array_map(fn ($r) => ['name' => $r['name'], 'type' => 'view'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listProcedures(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query("SELECT name FROM sys.procedures WHERE is_ms_shipped = 0");

        return array_map(fn ($r) => ['name' => $r['name'], 'type' => 'procedure'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listFunctions(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query("SELECT name FROM sys.objects WHERE type IN ('FN','IF','TF')");

        return array_map(fn ($r) => ['name' => $r['name'], 'type' => 'function'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listTriggers(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query('SELECT name, OBJECT_NAME(parent_id) AS table_name FROM sys.triggers');

        return array_map(fn ($r) => ['name' => $r['name'], 'table' => $r['table_name'], 'type' => 'trigger'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function describeColumns(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array
    {
        $stmt = $pdo->prepare(
            "SELECT c.name, t.name AS data_type, c.is_nullable, dc.definition AS column_default, c.is_identity
             FROM sys.columns c
             JOIN sys.types t ON c.user_type_id = t.user_type_id
             LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
             WHERE c.object_id = OBJECT_ID(?)
             ORDER BY c.column_id"
        );
        $stmt->execute([$table]);

        return array_map(fn ($r) => [
            'name' => $r['name'],
            'type' => $r['data_type'],
            'nullable' => (bool) $r['is_nullable'],
            'default' => $r['column_default'],
            'primary_key' => false,
            'auto_increment' => (bool) $r['is_identity'],
            'max_length' => null,
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function describeIndexes(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array
    {
        $stmt = $pdo->prepare(
            "SELECT i.name, i.is_unique FROM sys.indexes i
             INNER JOIN sys.tables t ON i.object_id = t.object_id WHERE t.name = ? AND i.name IS NOT NULL"
        );
        $stmt->execute([$table]);

        return array_map(fn ($r) => [
            'name' => $r['name'],
            'unique' => (bool) $r['is_unique'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function describeForeignKeys(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array
    {
        $stmt = $pdo->prepare(
            "SELECT fk.name, cp.name AS column_name, rt.name AS referenced_table, cr.name AS referenced_column
             FROM sys.foreign_keys fk
             INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
             INNER JOIN sys.columns cp ON fkc.parent_column_id = cp.column_id AND fkc.parent_object_id = cp.object_id
             INNER JOIN sys.columns cr ON fkc.referenced_column_id = cr.column_id AND fkc.referenced_object_id = cr.object_id
             INNER JOIN sys.tables rt ON fkc.referenced_object_id = rt.object_id
             INNER JOIN sys.tables pt ON fkc.parent_object_id = pt.object_id
             WHERE pt.name = ?"
        );
        $stmt->execute([$table]);

        return array_map(fn ($r) => [
            'name' => $r['name'],
            'column' => $r['column_name'],
            'referenced_table' => $r['referenced_table'],
            'referenced_column' => $r['referenced_column'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function estimateRowCount(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): int
    {
        $stmt = $pdo->prepare(
            'SELECT SUM(p.rows) FROM sys.partitions p INNER JOIN sys.tables t ON p.object_id = t.object_id WHERE t.name = ?'
        );
        $stmt->execute([$table]);

        return (int) $stmt->fetchColumn();
    }

    protected function qualifyTable(string $table, ?string $schema): string
    {
        return '[' . str_replace(']', ']]', $table) . ']';
    }

    protected function quoteIdentifier(string $identifier): string
    {
        return '[' . str_replace(']', ']]', $identifier) . ']';
    }

    protected function primaryKeyColumn(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): ?string
    {
        $stmt = $pdo->prepare(
            "SELECT c.name FROM sys.indexes i
             INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
             INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
             INNER JOIN sys.tables t ON i.object_id = t.object_id
             WHERE i.is_primary_key = 1 AND t.name = ?"
        );
        $stmt->execute([$table]);
        $col = $stmt->fetchColumn();

        return $col ? (string) $col : null;
    }
}
