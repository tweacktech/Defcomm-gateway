<?php

namespace App\Modules\SecureDB\Models;

use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SecureDbWebhookDelivery extends Model
{
    use HasUuid;

    protected $table = 'secure_db_webhook_deliveries';

    protected $fillable = [
        'webhook_id', 'event', 'payload', 'status', 'attempts',
        'response_code', 'response_body', 'next_retry_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'next_retry_at' => 'datetime',
        ];
    }

    public function webhook(): BelongsTo
    {
        return $this->belongsTo(SecureDbWebhook::class, 'webhook_id');
    }
}
