<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\DTOs\ConnectionTestResult;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbLog;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use PDO;
use RuntimeException;

class ConnectionService
{
    public function defaultPort(string $type): int
    {
        return match ($type) {
            'postgresql' => 5432,
            'sqlserver' => 1433,
            'mongodb' => 27017,
            'redis' => 6379,
            default => 3306,
        };
    }

    public function encryptCredentials(string $username, string $password, ?array $sshConfig = null): array
    {
        return [
            'username_encrypted' => Crypt::encryptString($username),
            'password_encrypted' => Crypt::encryptString($password),
            'ssh_config_encrypted' => $sshConfig ? Crypt::encryptString(json_encode($sshConfig)) : null,
        ];
    }

    public function decryptCredentials(SecureDbConnection $connection): array
    {
        $ssh = null;
        if ($connection->ssh_config_encrypted) {
            $raw = is_string($connection->ssh_config_encrypted)
                ? $connection->ssh_config_encrypted
                : null;
            if ($raw) {
                $ssh = json_decode(Crypt::decryptString($raw), true);
            }
        }

        return [
            'username' => Crypt::decryptString($connection->username_encrypted),
            'password' => Crypt::decryptString($connection->password_encrypted),
            'ssh_config' => $ssh,
        ];
    }

    public function testConnectionDetailed(SecureDbConnection $connection): ConnectionTestResult
    {
        try {
            $result = app(DatabaseExplorerFactory::class)->for($connection)->test($connection);

            if (! $result->success && $result->message) {
                $result->message = $this->sanitizeError($result->message);
            }

            $connection->update([
                'health_status' => $result->success ? 'healthy' : 'unhealthy',
                'last_health_check_at' => now(),
                'last_connected_at' => $result->success ? now() : $connection->last_connected_at,
                'last_error' => $result->success ? null : $result->message,
                'connection_metadata' => $result->toArray(),
            ]);

            if (! $result->success) {
                $this->logConnectionEvent($connection, 'error', 'connection_test_failed', $result->message ?? 'Unknown error');
            }

            return $result;
        } catch (\Throwable $e) {
            $message = $this->sanitizeError($e->getMessage());
            $connection->update([
                'health_status' => 'unhealthy',
                'last_health_check_at' => now(),
                'last_error' => $message,
            ]);
            $this->logConnectionEvent($connection, 'error', 'connection_test_failed', $message);
            Log::warning('SecureDB connection test failed', ['connection_id' => $connection->id, 'error' => $message]);

            return new ConnectionTestResult(false, 'failed', $message, driver: $connection->database_type);
        }
    }

    public function testConnection(SecureDbConnection $connection): bool
    {
        return $this->testConnectionDetailed($connection)->success;
    }

    public function connect(SecureDbConnection $connection): mixed
    {
        $creds = $this->decryptCredentials($connection);
        $timeout = max(1, (int) ($connection->connection_timeout ?? 10));

        return match ($connection->database_type) {
            'mysql', 'mariadb' => $this->connectMysql($connection, $creds, $timeout),
            'postgresql' => $this->connectPostgres($connection, $creds, $timeout),
            'sqlserver' => $this->connectSqlServer($connection, $creds, $timeout),
            'mongodb' => $this->connectMongo($connection, $creds, $timeout),
            'redis' => $this->connectRedis($connection, $creds, $timeout),
            default => throw new RuntimeException("Unsupported database type: {$connection->database_type}"),
        };
    }

    public function buildLaravelConfig(SecureDbConnection $connection): array
    {
        $creds = $this->decryptCredentials($connection);
        $name = 'secure_db_' . $connection->id;

        return match ($connection->database_type) {
            'mysql', 'mariadb' => [
                'driver' => 'mysql',
                'host' => $connection->host,
                'port' => $connection->port,
                'database' => $connection->database_name,
                'username' => $creds['username'],
                'password' => $creds['password'],
                'charset' => $connection->charset ?? 'utf8mb4',
                'collation' => $connection->collation ?? 'utf8mb4_unicode_ci',
                'options' => extension_loaded('pdo_mysql') ? array_filter([
                    PDO::MYSQL_ATTR_SSL_CA => $connection->ssl_enabled ? '' : null,
                ]) : [],
            ],
            'postgresql' => [
                'driver' => 'pgsql',
                'host' => $connection->host,
                'port' => $connection->port,
                'database' => $connection->database_name,
                'username' => $creds['username'],
                'password' => $creds['password'],
                'charset' => $connection->charset ?? 'utf8',
                'sslmode' => $connection->ssl_enabled ? 'require' : 'prefer',
            ],
            'sqlserver' => [
                'driver' => 'sqlsrv',
                'host' => $connection->host,
                'port' => $connection->port,
                'database' => $connection->database_name,
                'username' => $creds['username'],
                'password' => $creds['password'],
            ],
            default => throw new RuntimeException('Dynamic Laravel config not supported for ' . $connection->database_type),
        };
    }

    protected function connectMysql(SecureDbConnection $connection, array $creds, int $timeout): PDO
    {
        $charset = $connection->charset ?? 'utf8mb4';
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=%s',
            $connection->host,
            $connection->port,
            $connection->database_name,
            $charset
        );

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => $timeout,
        ];

        $pdo = new PDO($dsn, $creds['username'], $creds['password'], $options);
        if ($connection->collation) {
            $pdo->exec('SET NAMES ' . $charset . ' COLLATE ' . $connection->collation);
        }
        $pdo->query('SELECT 1');

        return $pdo;
    }

    protected function connectPostgres(SecureDbConnection $connection, array $creds, int $timeout): PDO
    {
        $ssl = $connection->ssl_enabled ? 'sslmode=require' : 'sslmode=prefer';
        $dsn = sprintf(
            'pgsql:host=%s;port=%d;dbname=%s;%s',
            $connection->host,
            $connection->port,
            $connection->database_name,
            $ssl
        );

        $pdo = new PDO($dsn, $creds['username'], $creds['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => $timeout,
        ]);
        $pdo->query('SELECT 1');

        return $pdo;
    }

    protected function connectSqlServer(SecureDbConnection $connection, array $creds, int $timeout): PDO
    {
        if (! extension_loaded('pdo_sqlsrv')) {
            throw new RuntimeException('PDO SQL Server driver (pdo_sqlsrv) is not installed.');
        }

        $dsn = sprintf(
            'sqlsrv:Server=%s,%d;Database=%s;TrustServerCertificate=%s;LoginTimeout=%d',
            $connection->host,
            $connection->port,
            $connection->database_name,
            $connection->ssl_enabled ? '0' : '1',
            $timeout
        );

        $pdo = new PDO($dsn, $creds['username'], $creds['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $pdo->query('SELECT 1');

        return $pdo;
    }

    protected function connectMongo(SecureDbConnection $connection, array $creds, int $timeout): \MongoDB\Client
    {
        if (! class_exists(\MongoDB\Client::class)) {
            throw new RuntimeException('MongoDB PHP library required. Install ext-mongodb and mongodb/mongodb.');
        }

        $auth = ($creds['username'] && $creds['password'])
            ? sprintf('%s:%s@', urlencode($creds['username']), urlencode($creds['password']))
            : '';

        $uri = sprintf(
            'mongodb://%s%s:%d/%s',
            $auth,
            $connection->host,
            $connection->port,
            $connection->database_name
        );

        if ($connection->ssl_enabled) {
            $uri = str_replace('mongodb://', 'mongodb+srv://', $uri);
        }

        $client = new \MongoDB\Client($uri, [], ['serverSelectionTimeoutMS' => $timeout * 1000]);
        $client->selectDatabase($connection->database_name)->command(['ping' => 1]);

        return $client;
    }

    protected function connectRedis(SecureDbConnection $connection, array $creds, int $timeout): \Redis
    {
        if (! extension_loaded('redis')) {
            throw new RuntimeException('PHP Redis extension is required for Redis connections.');
        }

        $redis = new \Redis;
        $connected = $connection->ssl_enabled
            ? $redis->connect('tls://' . $connection->host, $connection->port, $timeout)
            : $redis->connect($connection->host, $connection->port, $timeout);

        if (! $connected) {
            throw new RuntimeException('Redis connection failed.');
        }

        if ($creds['password']) {
            $redis->auth($creds['password']);
        }

        $redis->select((int) ($connection->redis_database ?? 0));
        $redis->ping();

        return $redis;
    }

    public function reconnectIfNeeded(SecureDbConnection $connection): void
    {
        if ($connection->auto_reconnect && $connection->health_status !== 'healthy') {
            $this->testConnection($connection);
        }
    }

    protected function logConnectionEvent(SecureDbConnection $connection, string $level, string $event, string $message): void
    {
        SecureDbLog::create([
            'uuid' => (string) Str::uuid(),
            'project_id' => $connection->project_id,
            'connection_id' => $connection->id,
            'level' => $level,
            'event' => $event,
            'message' => $message,
            'context' => ['database_type' => $connection->database_type],
            'created_at' => now(),
        ]);
    }

    protected function sanitizeError(string $message): string
    {
        $message = preg_replace('/\busing password\s+\S+/i', 'using password [redacted]', $message) ?? $message;
        $message = preg_replace('/password[=:\s][^\s;\)]*/i', 'password [redacted]', $message) ?? $message;

        return preg_replace('/:\/\/[^:]+:[^@]+@/', '://[redacted]:[redacted]@', $message) ?? $message;
    }
}
