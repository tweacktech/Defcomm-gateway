<?php

namespace App\Modules\SecureDB\Services\Explorers;

class MariadbExplorer extends MysqlExplorer
{
    protected function driverName(): string
    {
        return 'mariadb';
    }
}
