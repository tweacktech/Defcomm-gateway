<?php

namespace App\Modules\SecureDB\Models;

use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecureDbRotationLog extends Model
{
    use HasUuid;

    public $timestamps = false;

    protected $table = 'secure_db_rotation_logs';

    protected $fillable = [
        'project_id', 'old_key_id', 'new_key_id', 'status', 'records_processed',
        'records_failed', 'error_message', 'metadata', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(SecureDbProject::class, 'project_id');
    }
}
