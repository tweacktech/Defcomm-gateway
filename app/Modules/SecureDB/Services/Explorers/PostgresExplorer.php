<?php

namespace App\Modules\SecureDB\Services\Explorers;

use App\Modules\SecureDB\Models\SecureDbConnection;
use PDO;

class PostgresExplorer extends AbstractSqlExplorer
{
    protected function driverName(): string
    {
        return 'pgsql';
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
        return (string) $pdo->query('SELECT version()')->fetchColumn();
    }

    protected function fetchEncoding(PDO $pdo, SecureDbConnection $connection): ?string
    {
        $stmt = $pdo->query('SHOW server_encoding');

        return $stmt ? (string) $stmt->fetchColumn() : null;
    }

    protected function listSchemas(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' ORDER BY schema_name");

        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'schema_name');
    }

    protected function listTables(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->prepare(
            "SELECT c.relname AS name, c.reltuples::bigint AS row_count, pg_total_relation_size(c.oid) AS size_bytes
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname"
        );
        $stmt->execute();

        return array_map(fn ($r) => [
            'name' => $r['name'],
            'type' => 'table',
            'row_count' => (int) $r['row_count'],
            'size_bytes' => (int) $r['size_bytes'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listViews(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query("SELECT table_name AS name FROM information_schema.views WHERE table_schema = 'public'");

        return array_map(fn ($r) => ['name' => $r['name'], 'type' => 'view'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listProcedures(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query("SELECT routine_name AS name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE'");

        return array_map(fn ($r) => ['name' => $r['name'], 'type' => 'procedure'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listFunctions(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query("SELECT routine_name AS name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'");

        return array_map(fn ($r) => ['name' => $r['name'], 'type' => 'function'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function listTriggers(PDO $pdo, SecureDbConnection $connection): array
    {
        $stmt = $pdo->query("SELECT trigger_name AS name, event_object_table AS table FROM information_schema.triggers WHERE trigger_schema = 'public'");

        return array_map(fn ($r) => ['name' => $r['name'], 'table' => $r['table'], 'type' => 'trigger'], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function describeColumns(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array
    {
        $stmt = $pdo->prepare(
            "SELECT column_name, data_type, is_nullable, column_default,
                    (SELECT COUNT(*) > 0 FROM information_schema.key_column_usage k
                     JOIN information_schema.table_constraints t ON t.constraint_name = k.constraint_name
                     WHERE t.constraint_type = 'PRIMARY KEY' AND k.table_name = c.table_name AND k.column_name = c.column_name) AS is_pk
             FROM information_schema.columns c
             WHERE table_schema = 'public' AND table_name = ?
             ORDER BY ordinal_position"
        );
        $stmt->execute([$table]);

        return array_map(fn ($r) => [
            'name' => $r['column_name'],
            'type' => $r['data_type'],
            'nullable' => $r['is_nullable'] === 'YES',
            'default' => $r['column_default'],
            'primary_key' => (bool) $r['is_pk'],
            'auto_increment' => str_contains((string) $r['column_default'], 'nextval'),
            'max_length' => null,
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function describeIndexes(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array
    {
        $stmt = $pdo->prepare("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ?");
        $stmt->execute([$table]);

        return array_map(fn ($r) => [
            'name' => $r['indexname'],
            'definition' => $r['indexdef'],
            'unique' => str_contains($r['indexdef'], 'UNIQUE'),
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function describeForeignKeys(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): array
    {
        $stmt = $pdo->prepare(
            "SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
             JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
             WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = ?"
        );
        $stmt->execute([$table]);

        return array_map(fn ($r) => [
            'name' => $r['constraint_name'],
            'column' => $r['column_name'],
            'referenced_table' => $r['referenced_table'],
            'referenced_column' => $r['referenced_column'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    protected function estimateRowCount(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): int
    {
        $stmt = $pdo->prepare("SELECT reltuples::bigint FROM pg_class WHERE relname = ?");
        $stmt->execute([$table]);

        return (int) $stmt->fetchColumn();
    }

    protected function qualifyTable(string $table, ?string $schema): string
    {
        return '"' . str_replace('"', '""', $table) . '"';
    }

    protected function quoteIdentifier(string $identifier): string
    {
        return '"' . str_replace('"', '""', $identifier) . '"';
    }

    protected function primaryKeyColumn(PDO $pdo, SecureDbConnection $connection, string $table, ?string $schema): ?string
    {
        $stmt = $pdo->prepare(
            "SELECT kcu.column_name FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
             WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = ? LIMIT 1"
        );
        $stmt->execute([$table]);
        $col = $stmt->fetchColumn();

        return $col ? (string) $col : null;
    }
}
