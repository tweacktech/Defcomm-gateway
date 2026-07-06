<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use App\Models\Subscription;
use App\Models\UserPlan;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens;

    use HasFactory;
    use Notifiable;
    use TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'role',
        'email',
        'password',
        'status',
        'organization_id',
        'plan_id',
        'subscription_active',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'subscription_active' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function apiClients(): HasMany
    {
        return $this->hasMany(ApiClient::class);
    }

    public function userRole(): UserRole
    {
        return UserRole::tryFrom($this->role) ?? UserRole::Client;
    }

    public function isSuperAdmin(): bool
    {
        return $this->userRole()->isSuperAdmin();
    }

    public function isCompanyAdmin(): bool
    {
        return $this->userRole()->isCompanyAdmin();
    }

    public function isAtLeastCompanyAdmin(): bool
    {
        return $this->userRole()->isAtLeastCompanyAdmin();
    }

    public function roleLabel(): string
    {
        return $this->userRole()->label();
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(UserPlan::class, 'plan_id');
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany('starts_at');
    }

    public function hasActivePlan(): bool
    {
        return $this->plan_id !== null && $this->plan?->status === 'active';
    }

    public function isSubscriptionEnabled(): bool
    {
        return $this->subscription_active && $this->hasActivePlan();
    }

    public function subscriptionStatus(): string
    {
        if (!$this->subscription_active) {
            return 'disabled';
        }

        if (!$this->hasActivePlan()) {
            return 'unsubscribed';
        }

        return 'active';
    }

    public function rolePermissions(): array
    {
        return match ($this->role) {
            UserRole::SuperAdmin->value => ['manage_system', 'manage_users', 'manage_organizations', 'view_reports'],
            UserRole::CompanyAdmin->value => ['manage_organization_users', 'manage_organization_settings', 'view_organization_reports'],
            default => [],
        };
    }

    public function featurePermissions(): array
    {
        if ($this->isSuperAdmin()) {
            return [
                'chat' => true,
                'meeting' => true,
                'call' => true,
                'walkie' => true,
                'upload' => true,
                'storage_limit' => $this->storage_limit,
                'plan_name' => $this->plan?->name,
                'plan_status' => $this->plan?->status,
            ];
        }

        return [
            'chat' => $this->isSubscriptionEnabled() && $this->plan?->enable_chat === 'yes',
            'meeting' => $this->isSubscriptionEnabled() && $this->plan?->enable_meeting === 'yes',
            'call' => $this->isSubscriptionEnabled() && $this->plan?->enable_call === 'yes',
            'walkie' => $this->isSubscriptionEnabled() && $this->plan?->enable_walkie === 'yes',
            'upload' => $this->isSubscriptionEnabled(),
            'storage_limit' => $this->plan?->file_size,
            'plan_name' => $this->plan?->name,
            'plan_status' => $this->plan?->status,
        ];
    }

    public function permissions(): array
    {
        return [
            'role' => $this->rolePermissions(),
            'features' => $this->featurePermissions(),
        ];
    }
}
