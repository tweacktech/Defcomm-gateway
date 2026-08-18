<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Contracts\DatabaseExplorerInterface;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Services\Explorers\MariadbExplorer;
use App\Modules\SecureDB\Services\Explorers\MongoExplorer;
use App\Modules\SecureDB\Services\Explorers\MysqlExplorer;
use App\Modules\SecureDB\Services\Explorers\PostgresExplorer;
use App\Modules\SecureDB\Services\Explorers\RedisExplorer;
use App\Modules\SecureDB\Services\Explorers\SqlServerExplorer;
use RuntimeException;

class DatabaseExplorerFactory
{
    public function __construct(
        protected MysqlExplorer $mysql,
        protected MariadbExplorer $mariadb,
        protected PostgresExplorer $postgres,
        protected SqlServerExplorer $sqlserver,
        protected MongoExplorer $mongo,
        protected RedisExplorer $redis,
    ) {}

    public function for(SecureDbConnection $connection): DatabaseExplorerInterface
    {
        return match ($connection->database_type) {
            'mysql' => $this->mysql,
            'mariadb' => $this->mariadb,
            'postgresql' => $this->postgres,
            'sqlserver' => $this->sqlserver,
            'mongodb' => $this->mongo,
            'redis' => $this->redis,
            default => throw new RuntimeException("Unsupported database type: {$connection->database_type}"),
        };
    }
}
