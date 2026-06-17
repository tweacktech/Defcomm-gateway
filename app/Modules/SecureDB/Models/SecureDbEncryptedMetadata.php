<?php

namespace App\Modules\SecureDB\Models;

use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecureDbEncryptedMetadata extends Model
{
    use HasUuid;

    protected $table = 'secure_db_encrypted_metadata';

    protected $fillable = [
        'project_id', 'connection_id', 'policy_id', 'key_id', 'table_name',
        'collection_name', 'record_identifier', 'field_name', 'encryption_scope',
        'algorithm', 'key_version', 'metadata',
    ];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(SecureDbProject::class, 'project_id');
    }

    public function key(): BelongsTo
    {
        return $this->belongsTo(SecureDbKey::class, 'key_id');
    }
}
