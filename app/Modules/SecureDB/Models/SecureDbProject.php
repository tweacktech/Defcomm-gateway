<?php

namespace App\Modules\SecureDB\Models;

use App\Models\User;
use App\Modules\SecureDB\Concerns\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SecureDbProject extends Model
{
    use HasUuid;
    use SoftDeletes;

    protected $table = 'secure_db_projects';

    protected $fillable = [
        'owner_id', 'created_by', 'updated_by', 'name', 'description', 'status',
        'environment', 'api_key', 'secret_key_hash', 'encryption_mode', 'rotation_interval',
        'rotation_cron', 'default_algorithm', 'allowed_ips', 'rate_limit_per_minute',
        'encrypted_records_count', 'last_rotation_at',
    ];

    protected $hidden = ['secret_key_hash'];

    protected function casts(): array
    {
        return [
            'allowed_ips' => 'array',
            'last_rotation_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function connections(): HasMany
    {
        return $this->hasMany(SecureDbConnection::class, 'project_id');
    }

    public function policies(): HasMany
    {
        return $this->hasMany(SecureDbEncryptionPolicy::class, 'project_id');
    }

    public function keys(): HasMany
    {
        return $this->hasMany(SecureDbKey::class, 'project_id');
    }

    public function devices(): HasMany
    {
        return $this->hasMany(SecureDbDevice::class, 'project_id');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'secure_db_project_user', 'project_id', 'user_id')
            ->withPivot('role_id')->withTimestamps();
    }

    public function webhooks(): HasMany
    {
        return $this->hasMany(SecureDbWebhook::class, 'project_id');
    }

    public function activeKey(): ?SecureDbKey
    {
        return $this->keys()->where('status', 'active')->where('key_type', 'project')->latest()->first();
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
