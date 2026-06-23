<?php

namespace App\Modules\SecureDB\Models;

use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SecureDbKey extends Model
{
    use HasUuid;
    use SoftDeletes;

    protected $table = 'secure_db_keys';

    protected $fillable = [
        'project_id', 'created_by', 'key_type', 'key_version', 'encrypted_key_material',
        'encrypted_dek', 'algorithm', 'status', 'expires_at', 'rotated_at', 'revoked_at', 'metadata',
    ];

    protected $hidden = ['encrypted_key_material', 'encrypted_dek'];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'expires_at' => 'datetime',
            'rotated_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(SecureDbProject::class, 'project_id');
    }
}
