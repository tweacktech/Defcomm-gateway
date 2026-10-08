<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class BountyUser extends Authenticatable
{
    use HasApiTokens;

    protected $fillable = [
        'first_name', 'last_name', 'username', 'email', 'password', 'country',
        'group_company', 'phone', 'otp', 'zipcode', 'timezone', 'photo', 'bio',
        'balance', 'user_type', 'status', 'email_verified',
    ];

    protected $hidden = ['password', 'otp', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'email_verified' => 'boolean',
            'balance' => 'decimal:2',
        ];
    }

    public function reports(): HasMany
    {
        return $this->hasMany(BountyReport::class);
    }
}
