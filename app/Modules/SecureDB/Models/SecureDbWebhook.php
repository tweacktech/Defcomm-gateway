<?php

namespace App\Modules\SecureDB\Models;

use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SecureDbWebhook extends Model
{
    use HasUuid;
    use SoftDeletes;

    protected $table = 'secure_db_webhooks';

    protected $fillable = [
        'project_id', 'url', 'events', 'secret_hash', 'is_active', 'max_retries',
    ];

    protected $hidden = ['secret_hash'];

    protected function casts(): array
    {
        return [
            'events' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(SecureDbProject::class, 'project_id');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(SecureDbWebhookDelivery::class, 'webhook_id');
    }
}
