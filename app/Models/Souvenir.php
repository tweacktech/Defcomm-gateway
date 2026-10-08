<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Souvenir extends Model
{
    protected $fillable = [
        'event_form_id', 'user_id', 'title', 'image', 'status',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(EventForm::class, 'event_form_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function registrationLinks(): HasMany
    {
        return $this->hasMany(SouvenirRegistration::class);
    }

    public function imageUrl(): ?string
    {
        if (! $this->image) {
            return null;
        }

        return str_starts_with($this->image, 'http') ? $this->image : asset('storage/'.$this->image);
    }
}
