<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EventAttendance extends Model
{
    protected $fillable = [
        'event_form_id', 'user_id', 'clock_in_at', 'clock_out_at',
        'latitude', 'longitude', 'comment', 'location', 'timezone',
    ];

    protected function casts(): array
    {
        return [
            'clock_in_at' => 'datetime',
            'clock_out_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(EventForm::class, 'event_form_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
