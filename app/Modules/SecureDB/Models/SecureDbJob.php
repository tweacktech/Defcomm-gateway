<?php

namespace App\Modules\SecureDB\Models;

use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecureDbJob extends Model
{
    use HasUuid;

    protected $table = 'secure_db_jobs';

    protected $fillable = [
        'project_id', 'connection_id', 'job_type', 'status', 'payload',
        'result', 'error_message', 'attempts', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'result' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(SecureDbProject::class, 'project_id');
    }
}
