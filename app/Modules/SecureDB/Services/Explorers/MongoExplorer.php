<?php

namespace App\Modules\SecureDB\Services\Explorers;

use App\Modules\SecureDB\Contracts\DatabaseExplorerInterface;
use App\Modules\SecureDB\DTOs\ConnectionTestResult;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\EncryptionFieldService;
use RuntimeException;

class MongoExplorer implements DatabaseExplorerInterface
{
    public function __construct(
        protected ConnectionService $connections,
        protected EncryptionFieldService $encryptionFields,
    ) {}

    public function test(SecureDbConnection $connection): ConnectionTestResult
    {
        $start = microtime(true);

        try {
            $client = $this->client($connection);
            $db = $client->selectDatabase($connection->database_name);
            $db->command(['ping' => 1]);
            $buildInfo = $db->command(['buildInfo' => 1])->toArray()[0] ?? [];

            return new ConnectionTestResult(
                success: true,
                status: 'connected',
                message: 'MongoDB connection established.',
                pingMs: round((microtime(true) - $start) * 1000, 2),
                driver: 'mongodb',
                serverVersion: (string) ($buildInfo['version'] ?? 'unknown'),
                databaseVersion: (string) ($buildInfo['version'] ?? 'unknown'),
                currentDatabase: $connection->database_name,
            );
        } catch (\Throwable $e) {
            return new ConnectionTestResult(false, 'failed', $e->getMessage(), round((microtime(true) - $start) * 1000, 2), 'mongodb');
        }
    }

    public function discoverSchema(SecureDbConnection $connection): array
    {
        $client = $this->client($connection);
        $collections = [];
        foreach ($client->selectDatabase($connection->database_name)->listCollections() as $info) {
            $name = $info->getName();
            $col = $client->selectCollection($connection->database_name, $name);
            $collections[] = [
                'name' => $name,
                'type' => 'collection',
                'document_count' => $col->countDocuments([], ['maxTimeMS' => 5000]),
                'indexes' => iterator_to_array($col->listIndexes()),
            ];
        }

        return [
            'databases' => [$connection->database_name],
            'collections' => $collections,
        ];
    }

    public function getObjectMetadata(SecureDbConnection $connection, string $objectName, ?string $schemaName = null): array
    {
        $col = $this->client($connection)->selectCollection($connection->database_name, $objectName);
        $sample = $col->findOne([], ['maxTimeMS' => 3000]);
        $fields = $sample ? array_keys((array) $sample) : [];
        $indexes = [];
        foreach ($col->listIndexes() as $idx) {
            $indexes[] = ['name' => $idx->getName(), 'key' => $idx->getKey()];
        }

        return [
            'name' => $objectName,
            'type' => 'collection',
            'document_count' => $col->countDocuments([], ['maxTimeMS' => 5000]),
            'fields' => $fields,
            'indexes' => $indexes,
            'encryption' => $this->encryptionFields->forTable($connection, $objectName),
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
        $col = $this->client($connection)->selectCollection($connection->database_name, $objectName);
        $perPage = min(max($perPage, 1), 200);
        $page = max($page, 1);
        $filter = [];

        if ($filterColumn && $filterValue !== null && $filterValue !== '') {
            $filter[$filterColumn] = $filterValue;
        }
        if ($search) {
            $filter['$text'] = ['$search' => $search];
        }

        $total = $col->countDocuments($filter, ['maxTimeMS' => 5000]);
        $options = ['limit' => $perPage, 'skip' => ($page - 1) * $perPage, 'maxTimeMS' => 10000];
        if ($sortColumn) {
            $options['sort'] = [$sortColumn => strtolower($sortDirection) === 'desc' ? -1 : 1];
        }

        $rows = [];
        foreach ($col->find($filter, $options) as $doc) {
            $rows[] = json_decode(json_encode($doc), true);
        }

        return [
            'columns' => $rows ? array_keys($rows[0]) : [],
            'rows' => $rows,
            'pagination' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => (int) ceil(max($total, 1) / $perPage),
            ],
            'encryption' => $this->encryptionFields->forTable($connection, $objectName),
        ];
    }

    public function exportData(
        SecureDbConnection $connection,
        string $objectName,
        ?string $schemaName = null,
        array $selectedIds = [],
        int $limit = 1000,
    ): array {
        $col = $this->client($connection)->selectCollection($connection->database_name, $objectName);
        $filter = $selectedIds ? ['_id' => ['$in' => $selectedIds]] : [];
        $rows = [];
        foreach ($col->find($filter, ['limit' => $limit, 'maxTimeMS' => 15000]) as $doc) {
            $rows[] = json_decode(json_encode($doc), true);
        }

        return $rows;
    }

    protected function client(SecureDbConnection $connection): \MongoDB\Client
    {
        if (! class_exists(\MongoDB\Client::class)) {
            throw new RuntimeException('MongoDB PHP library required. Install ext-mongodb and mongodb/mongodb via Composer.');
        }

        $result = $this->connections->connect($connection);
        if (! $result instanceof \MongoDB\Client) {
            throw new RuntimeException('Failed to establish MongoDB client.');
        }

        return $result;
    }
}
