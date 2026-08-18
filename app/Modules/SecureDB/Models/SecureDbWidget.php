<?php

namespace App\Modules\SecureDB\Models;

use App\Models\User;
use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SecureDbWidget extends Model
{
    use HasUuid;
    use SoftDeletes;

    protected $table = 'secure_db_widgets';

    protected $fillable = [
        'project_id', 'connection_id', 'created_by', 'name', 'widget_key',
        'secret_key_hash', 'language', 'database_type', 'allowed_origins',
        'is_active', 'access_count', 'last_used_at', 'metadata',
    ];

    protected $hidden = ['secret_key_hash'];

    protected function casts(): array
    {
        return [
            'allowed_origins' => 'array',
            'metadata' => 'array',
            'is_active' => 'boolean',
            'last_used_at' => 'datetime',
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

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
