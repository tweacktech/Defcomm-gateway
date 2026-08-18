<?php

namespace App\Modules\SecureDB\Models;

use Illuminate\Database\Eloquent\Model;

class SecureDbLog extends Model
{
    public $timestamps = false;

    protected $table = 'secure_db_logs';

    protected $fillable = [
        'uuid', 'project_id', 'connection_id', 'level', 'event', 'message', 'context', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'context' => 'array',
            'created_at' => 'datetime',
        ];
    }
}
