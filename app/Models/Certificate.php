<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Certificate extends Model
{
    protected $fillable = [
        'event_form_id', 'user_id', 'title', 'template', 'code', 'file_path', 'status',
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
        return $this->hasMany(CertificateRegistration::class);
    }

    public function templateUrl(): ?string
    {
        $path = $this->template ?: $this->file_path;
        if (! $path) {
            return null;
        }

        return str_starts_with($path, 'http') ? $path : asset('storage/'.$path);
    }
}
