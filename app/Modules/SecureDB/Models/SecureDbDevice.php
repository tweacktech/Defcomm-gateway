<?php

namespace App\Modules\SecureDB\Models;

use App\Models\User;
use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SecureDbDevice extends Model
{
    use HasUuid;
    use SoftDeletes;

    protected $table = 'secure_db_devices';

    protected $fillable = [
        'project_id', 'user_id', 'approved_by', 'device_name', 'fingerprint',
        'operating_system', 'browser', 'ip_address', 'location', 'status',
        'last_seen_at', 'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
            'approved_at' => 'datetime',
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
