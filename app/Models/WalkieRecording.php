<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalkieRecording extends Model
{
    protected $fillable = [
        'channel_id', 'user_id', 'subscriber_id', 'path', 'record', 'record_text',
        'file_size', 'file_ext', 'source_language',
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
