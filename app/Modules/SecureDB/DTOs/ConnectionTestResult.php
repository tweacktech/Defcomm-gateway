<?php

namespace App\Modules\SecureDB\DTOs;

class ConnectionTestResult
{
    public function __construct(
        public bool $success,
        public string $status,
        public ?string $message = null,
        public ?float $pingMs = null,
        public ?string $driver = null,
        public ?string $serverVersion = null,
        public ?string $databaseVersion = null,
        public ?string $currentDatabase = null,
        public ?string $characterEncoding = null,
    ) {}

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'status' => $this->status,
            'message' => $this->message,
            'ping_ms' => $this->pingMs,
            'driver' => $this->driver,
            'server_version' => $this->serverVersion,
            'database_version' => $this->databaseVersion,
            'current_database' => $this->currentDatabase,
            'character_encoding' => $this->characterEncoding,
        ];
    }
}
