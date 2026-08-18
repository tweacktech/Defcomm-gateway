<?php

namespace App\Modules\SecureDB\Contracts;

use App\Modules\SecureDB\DTOs\ConnectionTestResult;
use App\Modules\SecureDB\Models\SecureDbConnection;

interface DatabaseExplorerInterface
{
    public function test(SecureDbConnection $connection): ConnectionTestResult;

    public function discoverSchema(SecureDbConnection $connection): array;

    public function getObjectMetadata(SecureDbConnection $connection, string $objectName, ?string $schemaName = null): array;

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
    ): array;

    public function exportData(
        SecureDbConnection $connection,
        string $objectName,
        ?string $schemaName = null,
        array $selectedIds = [],
        int $limit = 1000,
    ): array;
}
