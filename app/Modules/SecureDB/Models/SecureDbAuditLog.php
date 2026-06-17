<?php

namespace App\Modules\SecureDB\Models;

use App\Models\User;
use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecureDbAuditLog extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $table = 'secure_db_audit_logs';

    protected $fillable = [
        'project_id', 'user_id', 'device_id', 'action', 'ip_address',
        'user_agent', 'description', 'metadata', 'success', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'success' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(SecureDbProject::class, 'project_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
