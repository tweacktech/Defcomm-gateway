<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SouvenirRegistration extends Model
{
    protected $fillable = [
        'souvenir_id', 'event_registration_id', 'is_collected',
    ];

    protected function casts(): array
    {
        return [
            'is_collected' => 'boolean',
        ];
    }

    public function souvenir(): BelongsTo
    {
        return $this->belongsTo(Souvenir::class);
    }

    public function registration(): BelongsTo
    {
        return $this->belongsTo(EventRegistration::class, 'event_registration_id');
    }
}
