<?php

namespace App\Modules\SecureDB\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecureDbConnectionSchema extends Model
{
    protected $table = 'secure_db_connection_schemas';

    protected $fillable = [
        'connection_id', 'object_type', 'schema_name', 'object_name',
        'row_count_estimate', 'size_bytes', 'columns_metadata',
        'indexes_metadata', 'relations_metadata', 'encryption_fields', 'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'columns_metadata' => 'array',
            'indexes_metadata' => 'array',
            'relations_metadata' => 'array',
            'encryption_fields' => 'array',
            'synced_at' => 'datetime',
        ];
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(SecureDbConnection::class, 'connection_id');
    }
}
