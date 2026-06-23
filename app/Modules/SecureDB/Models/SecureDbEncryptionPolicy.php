<?php

namespace App\Modules\SecureDB\Models;

use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SecureDbEncryptionPolicy extends Model
{
    use HasUuid;
    use SoftDeletes;

    protected $table = 'secure_db_encryption_policies';

    protected $fillable = [
        'project_id', 'connection_id', 'created_by', 'updated_by', 'name', 'scope',
        'target_table', 'target_collection', 'sensitive_fields', 'algorithm', 'is_active', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'sensitive_fields' => 'array',
            'metadata' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(SecureDbProject::class, 'project_id');
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(SecureDbConnection::class, 'connection_id');
    }
}
