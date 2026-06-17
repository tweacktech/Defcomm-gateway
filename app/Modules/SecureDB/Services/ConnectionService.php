<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbConnection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use PDO;
use RuntimeException;

class ConnectionService
{
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
            $ssh = json_decode(Crypt::decryptString($connection->ssh_config_encrypted), true);
        }

        return [
            'username' => Crypt::decryptString($connection->username_encrypted),
            'password' => Crypt::decryptString($connection->password_encrypted),
            'ssh_config' => $ssh,
        ];
    }

    public function testConnection(SecureDbConnection $connection): bool
    {
        try {
            $this->connect($connection);
            $connection->update([
                'health_status' => 'healthy',
                'last_health_check_at' => now(),
                'last_connected_at' => now(),
                'last_error' => null,
            ]);

            return true;
        } catch (\Throwable $e) {
            $connection->update([
                'health_status' => 'unhealthy',
                'last_health_check_at' => now(),
                'last_error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    public function connect(SecureDbConnection $connection): mixed
    {
        $creds = $this->decryptCredentials($connection);

        return match ($connection->database_type) {
            'mysql', 'mariadb' => $this->connectMysql($connection, $creds),
            'postgresql' => $this->connectPostgres($connection, $creds),
            'sqlserver' => $this->connectSqlServer($connection, $creds),
            'mongodb' => $this->connectMongo($connection, $creds),
            'redis' => $this->connectRedis($connection, $creds),
            default => throw new RuntimeException("Unsupported database type: {$connection->database_type}"),
        };
    }

    public function healthCheck(SecureDbConnection $connection): string
    {
        $healthy = $this->testConnection($connection);

        return $healthy ? 'healthy' : 'unhealthy';
    }

    protected function connectMysql(SecureDbConnection $connection, array $creds): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s',
            $connection->host,
            $connection->port,
            $connection->database_name
        );

        if ($connection->ssl_enabled) {
            $dsn .= ';sslmode=require';
        }

        $pdo = new PDO($dsn, $creds['username'], $creds['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
        ]);
        $pdo->query('SELECT 1');

        return $pdo;
    }

    protected function connectPostgres(SecureDbConnection $connection, array $creds): PDO
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
            PDO::ATTR_TIMEOUT => 5,
        ]);
        $pdo->query('SELECT 1');

        return $pdo;
    }

    protected function connectSqlServer(SecureDbConnection $connection, array $creds): PDO
    {
        $dsn = sprintf(
            'sqlsrv:Server=%s,%d;Database=%s;TrustServerCertificate=%s',
            $connection->host,
            $connection->port,
            $connection->database_name,
            $connection->ssl_enabled ? '0' : '1'
        );

        $pdo = new PDO($dsn, $creds['username'], $creds['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        $pdo->query('SELECT 1');

        return $pdo;
    }

    protected function connectMongo(SecureDbConnection $connection, array $creds): bool
    {
        if (! extension_loaded('mongodb')) {
            if (! class_exists(\MongoDB\Client::class)) {
                throw new RuntimeException('MongoDB PHP extension or library required.');
            }
        }

        $scheme = $connection->ssl_enabled ? 'mongodb+srv' : 'mongodb';
        $uri = sprintf(
            '%s://%s:%s@%s:%d/%s',
            $scheme,
            urlencode($creds['username']),
            urlencode($creds['password']),
            $connection->host,
            $connection->port,
            $connection->database_name
        );

        $client = new \MongoDB\Client($uri, [], ['serverSelectionTimeoutMS' => 5000]);
        $client->selectDatabase($connection->database_name)->command(['ping' => 1]);

        return true;
    }

    protected function connectRedis(SecureDbConnection $connection, array $creds): bool
    {
        if (! extension_loaded('redis') && ! class_exists(\Predis\Client::class)) {
            throw new RuntimeException('Redis extension or Predis required.');
        }

        if (extension_loaded('redis')) {
            $redis = new \Redis;
            $connected = $redis->connect($connection->host, $connection->port, 5);
            if (! $connected) {
                throw new RuntimeException('Redis connection failed.');
            }
            if ($creds['password']) {
                $redis->auth($creds['password']);
            }
            $redis->ping();

            return true;
        }

        $client = new \Predis\Client([
            'scheme' => $connection->ssl_enabled ? 'tls' : 'tcp',
            'host' => $connection->host,
            'port' => $connection->port,
            'password' => $creds['password'] ?: null,
        ]);
        $client->ping();

        return true;
    }

    public function reconnectIfNeeded(SecureDbConnection $connection): void
    {
        if (! $connection->auto_reconnect) {
            return;
        }

        if ($connection->health_status !== 'healthy') {
            $this->testConnection($connection);
        }
    }
}
