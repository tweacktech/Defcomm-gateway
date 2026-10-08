<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EventRegistration extends Model
{
    protected $fillable = [
        'event_form_id', 'user_id', 'name', 'email', 'phone', 'data', 'status', 'collection_status',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
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

    public function certificateLinks(): HasMany
    {
        return $this->hasMany(CertificateRegistration::class);
    }

    public function souvenirLinks(): HasMany
    {
        return $this->hasMany(SouvenirRegistration::class);
    }
}
