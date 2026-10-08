<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QrLoginRequest extends Model
{
    protected $fillable = [
        'code', 'status', 'approved_user_id', 'expires_at', 'approved_at', 'redeemed_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'approved_at' => 'datetime',
            'redeemed_at' => 'datetime',
        ];
    }

    public function approvedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_user_id');
    }
}
