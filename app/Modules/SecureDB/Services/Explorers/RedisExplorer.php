<?php

namespace App\Modules\SecureDB\Services\Explorers;

use App\Modules\SecureDB\Contracts\DatabaseExplorerInterface;
use App\Modules\SecureDB\DTOs\ConnectionTestResult;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\EncryptionFieldService;
use RuntimeException;

class RedisExplorer implements DatabaseExplorerInterface
{
    public function __construct(
        protected ConnectionService $connections,
        protected EncryptionFieldService $encryptionFields,
    ) {}

    public function test(SecureDbConnection $connection): ConnectionTestResult
    {
        $start = microtime(true);

        try {
            $redis = $this->redis($connection);
            $redis->ping();
            $info = $redis->info('server');

            return new ConnectionTestResult(
                success: true,
                status: 'connected',
                message: 'Redis connection established.',
                pingMs: round((microtime(true) - $start) * 1000, 2),
                driver: 'redis',
                serverVersion: (string) ($info['redis_version'] ?? 'unknown'),
                currentDatabase: (string) ($connection->redis_database ?? 0),
            );
        } catch (\Throwable $e) {
            return new ConnectionTestResult(false, 'failed', $e->getMessage(), round((microtime(true) - $start) * 1000, 2), 'redis');
        }
    }

    public function discoverSchema(SecureDbConnection $connection): array
    {
        $redis = $this->redis($connection);
        $db = (int) ($connection->redis_database ?? 0);
        $redis->select($db);

        $keys = $this->scanKeys($redis, '*', 500);
        $grouped = ['string' => 0, 'hash' => 0, 'list' => 0, 'set' => 0, 'zset' => 0, 'stream' => 0, 'other' => 0];
        $keyList = [];

        foreach ($keys as $key) {
            $type = $redis->type($key);
            $typeName = match ($type) {
                \Redis::REDIS_STRING => 'string',
                \Redis::REDIS_HASH => 'hash',
                \Redis::REDIS_LIST => 'list',
                \Redis::REDIS_SET => 'set',
                \Redis::REDIS_ZSET => 'zset',
                \Redis::REDIS_STREAM => 'stream',
                default => 'other',
            };
            $grouped[$typeName]++;
            $keyList[] = [
                'name' => $key,
                'type' => $typeName,
                'ttl' => $redis->ttl($key),
            ];
        }

        $memory = $redis->info('memory');

        return [
            'database' => $db,
            'keys' => $keyList,
            'key_types' => $grouped,
            'memory_used_bytes' => (int) ($memory['used_memory'] ?? 0),
        ];
    }

    public function getObjectMetadata(SecureDbConnection $connection, string $objectName, ?string $schemaName = null): array
    {
        $redis = $this->redis($connection);
        $redis->select((int) ($connection->redis_database ?? 0));
        $type = $redis->type($objectName);

        return [
            'name' => $objectName,
            'type' => $this->typeName($type),
            'ttl' => $redis->ttl($objectName),
            'preview' => $this->previewValue($redis, $objectName, $type),
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
        $redis = $this->redis($connection);
        $redis->select((int) ($connection->redis_database ?? 0));

        $pattern = $search ? "*{$search}*" : ($objectName === '__all__' ? '*' : $objectName);
        $allKeys = $this->scanKeys($redis, $pattern, 2000);
        $total = count($allKeys);
        $perPage = min(max($perPage, 1), 200);
        $page = max($page, 1);
        $slice = array_slice($allKeys, ($page - 1) * $perPage, $perPage);

        $rows = [];
        foreach ($slice as $key) {
            $type = $redis->type($key);
            $rows[] = [
                'key' => $key,
                'type' => $this->typeName($type),
                'ttl' => $redis->ttl($key),
                'preview' => $this->previewValue($redis, $key, $type),
            ];
        }

        return [
            'columns' => ['key', 'type', 'ttl', 'preview'],
            'rows' => $rows,
            'pagination' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => (int) ceil(max($total, 1) / $perPage),
            ],
            'encryption' => [],
        ];
    }

    public function exportData(
        SecureDbConnection $connection,
        string $objectName,
        ?string $schemaName = null,
        array $selectedIds = [],
        int $limit = 1000,
    ): array {
        return $this->browseData($connection, $objectName, null, 1, $limit)['rows'];
    }

    protected function redis(SecureDbConnection $connection): \Redis
    {
        $result = $this->connections->connect($connection);
        if (! $result instanceof \Redis) {
            throw new RuntimeException('Redis extension required for Redis connections.');
        }

        return $result;
    }

    protected function scanKeys(\Redis $redis, string $pattern, int $limit): array
    {
        $keys = [];
        $iterator = null;
        while (count($keys) < $limit) {
            $batch = $redis->scan($iterator, $pattern, 100);
            if ($batch === false) {
                break;
            }
            $keys = array_merge($keys, $batch);
        }

        return array_slice(array_unique($keys), 0, $limit);
    }

    protected function typeName(int $type): string
    {
        return match ($type) {
            \Redis::REDIS_STRING => 'string',
            \Redis::REDIS_HASH => 'hash',
            \Redis::REDIS_LIST => 'list',
            \Redis::REDIS_SET => 'set',
            \Redis::REDIS_ZSET => 'zset',
            \Redis::REDIS_STREAM => 'stream',
            default => 'other',
        };
    }

    protected function previewValue(\Redis $redis, string $key, int $type): string
    {
        $preview = match ($type) {
            \Redis::REDIS_STRING => (string) $redis->get($key),
            \Redis::REDIS_HASH => json_encode($redis->hGetAll($key)),
            \Redis::REDIS_LIST => json_encode($redis->lRange($key, 0, 4)),
            \Redis::REDIS_SET => json_encode($redis->sMembers($key)),
            \Redis::REDIS_ZSET => json_encode($redis->zRange($key, 0, 4, true)),
            default => '[binary/complex type]',
        };

        return mb_substr($preview, 0, 500);
    }
}
