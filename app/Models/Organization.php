<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    /** @use HasFactory<\Database\Factories\OrganizationFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'status',
        'client_id',
        'client_secret',
        'client_credentials_active',
        'client_credentials_created_at',
    ];

    protected $hidden = [
        'client_secret',
    ];

    protected $casts = [
        'status' => 'string',
        'client_credentials_active' => 'boolean',
        'client_credentials_created_at' => 'datetime',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
