<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbWidget;
use Illuminate\Support\Facades\Cache;

class WidgetClientConnectionService
{
    public function __construct(
        protected ConnectionService $connections,
    ) {}

    public function connect(string $sessionToken, SecureDbWidget $widget, array $credentials): array
    {
        if ($credentials['database_type'] !== $widget->database_type) {
            throw new \RuntimeException("This widget only supports {$widget->database_type} connections.");
        }

        $encrypted = $this->connections->encryptCredentials(
            $credentials['username'] ?? '',
            $credentials['password'] ?? '',
        );

        $connection = SecureDbConnection::create([
            'project_id' => $widget->project_id,
            'name' => 'Widget: ' . $widget->name . ' (' . $credentials['host'] . ')',
            'database_type' => $credentials['database_type'],
            'host' => $credentials['host'],
            'port' => (int) ($credentials['port'] ?: $this->connections->defaultPort($credentials['database_type'])),
            'database_name' => $credentials['database_name'] ?? ($credentials['database_type'] === 'redis' ? '0' : ''),
            ...$encrypted,
            'ssl_enabled' => (bool) ($credentials['ssl_enabled'] ?? false),
            'connection_timeout' => (int) ($credentials['connection_timeout'] ?? 10),
            'redis_database' => (int) ($credentials['redis_database'] ?? 0),
            'connection_metadata' => [
                'source' => 'widget',
                'widget_id' => $widget->uuid,
            ],
            'health_status' => 'unknown',
        ]);

        $test = $this->connections->testConnectionDetailed($connection);
        if (! $test->success) {
            $connection->delete();
            throw new \RuntimeException($test->message ?? 'Could not connect to the database.');
        }

        $this->storeSessionConnection($sessionToken, $connection->id);

        return [
            'connection_id' => $connection->id,
            'host' => $connection->host,
            'database_name' => $connection->database_name,
            'database_type' => $connection->database_type,
            'health_status' => $connection->health_status,
            'ping_ms' => $test->pingMs,
            'server_version' => $test->serverVersion,
        ];
    }

    public function status(string $sessionToken): ?array
    {
        $connectionId = Cache::get($this->cacheKey($sessionToken));
        if (! $connectionId) {
            return null;
        }

        $connection = SecureDbConnection::find($connectionId);
        if (! $connection) {
            Cache::forget($this->cacheKey($sessionToken));

            return null;
        }

        return [
            'uuid' => $connection->uuid,
            'host' => $connection->host,
            'port' => $connection->port,
            'database_name' => $connection->database_name,
            'database_type' => $connection->database_type,
            'health_status' => $connection->health_status,
        ];
    }

    public function resolve(string $sessionToken): ?SecureDbConnection
    {
        $connectionId = Cache::get($this->cacheKey($sessionToken));

        return $connectionId ? SecureDbConnection::find($connectionId) : null;
    }

    public function disconnect(string $sessionToken): void
    {
        Cache::forget($this->cacheKey($sessionToken));
    }

    protected function storeSessionConnection(string $sessionToken, int $connectionId): void
    {
        Cache::put($this->cacheKey($sessionToken), $connectionId, now()->addHours(8));
    }

    protected function cacheKey(string $sessionToken): string
    {
        return "secure_db_widget_connection:{$sessionToken}";
    }
}
