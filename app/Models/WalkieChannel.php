<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WalkieChannel extends Model
{
    protected $fillable = [
        'user_id', 'organization_id', 'name', 'frequency', 'description', 'status',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function subscribers(): HasMany
    {
        return $this->hasMany(WalkieSubscriber::class, 'channel_id');
    }

    public function recordings(): HasMany
    {
        return $this->hasMany(WalkieRecording::class, 'channel_id');
    }
}
