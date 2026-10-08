<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class OrganizationServiceKey extends Model
{
    use SoftDeletes;

    protected $table = 'organization_service_keys';

    protected $fillable = [
        'uuid',
        'organization_id',
        'service_id',
        'created_by',
        'name',
        'key_prefix',
        'key_lookup',
        'is_active',
        'last_used_at',
        'revoked_at',
    ];

    protected $hidden = ['key_lookup'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'last_used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    protected static function booting(): void
    {
        static::creating(function (self $model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isUsable(): bool
    {
        return $this->is_active && $this->revoked_at === null;
    }
}
