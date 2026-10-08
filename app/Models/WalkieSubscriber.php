<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalkieSubscriber extends Model
{
    protected $fillable = [
        'channel_id', 'user_id', 'user_type', 'status',
    ];

    public function channel(): BelongsTo
    {
        return $this->belongsTo(WalkieChannel::class, 'channel_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
