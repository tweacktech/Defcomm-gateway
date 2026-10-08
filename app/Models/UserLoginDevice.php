<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserLoginDevice extends Model
{
    protected $fillable = [
        'user_id', 'device_id', 'device_type', 'device_name', 'fcm_token', 'status', 'last_heartbeat_at',
    ];

    protected function casts(): array
    {
        return [
            'last_heartbeat_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
