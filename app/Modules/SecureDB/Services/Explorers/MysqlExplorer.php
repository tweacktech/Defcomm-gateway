<?php

namespace App\Modules\SecureDB\Services\Explorers;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\EncryptionFieldService;
use PDO;

class MysqlExplorer extends AbstractSqlExplorer
{
    protected function driverName(): string
    {
        return 'mysql';
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
        return (string) $pdo->query('SELECT VERSION()')->fetchColumn();
    }

    protected function fetchEncoding(PDO $pdo, SecureDbConnection $connection): ?string
    {
        $stmt = $pdo->query("SELECT DEFAULT_CHARACTER_SET_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = " . $pdo->quote($connection->database_name));

        return $stmt ? (string) $stmt->fetchColumn() : null;
    }

    protected function listSchemas(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME');

        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'SCHEMA_NAME');
    }

    protected function listTables(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->prepare(
            'SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, TABLE_TYPE
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = \'BASE TABLE\'
             ORDER BY TABLE_NAME'
        );
        $stmt->execute([$connection->database_name]);

        return array_map(fn ($r) => [
            'name' => $r['TABLE_NAME'],
            'type' => 'table',
            'row_count' => (int) ($r['TABLE_ROWS'] ?? 0),
            'size_bytes' => (int) ($r['DATA_LENGTH'] ?? 0),
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listViews(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->prepare(
            'SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME'
        );
        $stmt->execute([$connection->database_name]);

        return array_map(fn ($r) => ['name' => $r['TABLE_NAME'], 'type' => 'view'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listProcedures(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->prepare(
            'SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = \'PROCEDURE\''
        );
        $stmt->execute([$connection->database_name]);

        return array_map(fn ($r) => ['name' => $r['ROUTINE_NAME'], 'type' => 'procedure'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listFunctions(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->prepare(
            'SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = \'FUNCTION\''
        );
        $stmt->execute([$connection->database_name]);

        return array_map(fn ($r) => ['name' => $r['ROUTINE_NAME'], 'type' => 'function'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listTriggers(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->prepare(
            'SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?'
        );
        $stmt->execute([$connection->database_name]);

        return array_map(fn ($r) => [
            'name' => $r['TRIGGER_NAME'],
            'table' => $r['EVENT_OBJECT_TABLE'],
            'type' => 'trigger',
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function describeColumns(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array
    {
        $stmt = $pdo->prepare(
            'SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA, CHARACTER_MAXIMUM_LENGTH
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
             ORDER BY ORDINAL_POSITION'
        );
        $stmt->execute([$connection->database_name, $table]);

        return array_map(fn ($r) => [
            'name' => $r['COLUMN_NAME'],
            'type' => $r['DATA_TYPE'],
            'nullable' => $r['IS_NULLABLE'] === 'YES',
            'default' => $r['COLUMN_DEFAULT'],
            'primary_key' => $r['COLUMN_KEY'] === 'PRI',
            'auto_increment' => str_contains((string) $r['EXTRA'], 'auto_increment'),
            'max_length' => $r['CHARACTER_MAXIMUM_LENGTH'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function describeIndexes(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array
    {
        $stmt = $pdo->prepare(
            'SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
             ORDER BY INDEX_NAME, SEQ_IN_INDEX'
        );
        $stmt->execute([$connection->database_name, $table]);
        $grouped = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $grouped[$row['INDEX_NAME']]['name'] = $row['INDEX_NAME'];
            $grouped[$row['INDEX_NAME']]['unique'] = $row['NON_UNIQUE'] == 0;
            $grouped[$row['INDEX_NAME']]['columns'][] = $row['COLUMN_NAME'];
        }

        return array_values($grouped);
    }

    protected function describeForeignKeys(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array
    {
        $stmt = $pdo->prepare(
            'SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
             FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL'
        );
        $stmt->execute([$connection->database_name, $table]);

        return array_map(fn ($r) => [
            'name' => $r['CONSTRAINT_NAME'],
            'column' => $r['COLUMN_NAME'],
            'referenced_table' => $r['REFERENCED_TABLE_NAME'],
            'referenced_column' => $r['REFERENCED_COLUMN_NAME'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function estimateRowCount(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): int
    {
        $stmt = $pdo->prepare(
            'SELECT TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?'
        );
        $stmt->execute([$connection->database_name, $table]);

        return (int) $stmt->fetchColumn();
    }

    protected function qualifyTable(string $table, ?string $schema): string
    {
        return '`' . str_replace('`', '``', $table) . '`';
    }

    protected function quoteIdentifier(string $identifier): string
    {
        return '`' . str_replace('`', '``', $identifier) . '`';
    }

    protected function primaryKeyColumn(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): ?string
    {
        $stmt = $pdo->prepare(
            'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_KEY = \'PRI\' LIMIT 1'
        );
        $stmt->execute([$connection->database_name, $table]);
        $col = $stmt->fetchColumn();

        return $col ? (string) $col : null;
    }
}

class MariadbExplorer extends MysqlExplorer
{
    protected function driverName(): string
    {
        return 'mariadb';
    }
}
