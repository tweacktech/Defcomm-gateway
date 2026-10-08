<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CertificateRegistration extends Model
{
    protected $fillable = [
        'certificate_id', 'event_registration_id', 'is_collected', 'is_sent',
    ];

    protected function casts(): array
    {
        return [
            'is_collected' => 'boolean',
            'is_sent' => 'boolean',
        ];
    }

    public function certificate(): BelongsTo
    {
        return $this->belongsTo(Certificate::class);
    }

    public function registration(): BelongsTo
    {
        return $this->belongsTo(EventRegistration::class, 'event_registration_id');
    }
}
