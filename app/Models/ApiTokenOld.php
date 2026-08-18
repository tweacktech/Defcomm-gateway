<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * API Token model for service-to-service authentication.
 * Each external service gets a unique token for making authenticated requests.
 */
class ApiTokenOld extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'token',
        'scopes',
        'last_used_at',
        'expires_at',
        'is_active',
    ];

    protected $casts = [
        'scopes' => 'json',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    protected $hidden = ['token'];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ── Factories ─────────────────────────────────────────────────────────────

    /**
     * Generate a new API token.
     *
     * @param User $user User who owns this token
     * @param string $name Human-readable name (e.g., "Mobile App", "Backend Service")
     * @param array $scopes List of allowed scopes
     * @param int|null $expiresInDays Days until expiration (null = never expires)
     * @return self
     */
    public static function create(
        User $user,
        string $name,
        array $scopes = [],
        ?int $expiresInDays = null
    ): self {
        $token = 'token_' . Str::random(40);

        return parent::create([
            'user_id' => $user->id,
            'name' => $name,
            'token' => hash('sha256', $token),
            'scopes' => $scopes ?: ['read'],
            'expires_at' => $expiresInDays ? now()->addDays($expiresInDays) : null,
            'is_active' => true,
        ])->fresh();
    }

    // ── Validation & State helpers ────────────────────────────────────────────

    /**
     * Check if the token is still valid (active and not expired).
     */
    public function isValid(): bool
    {
        return $this->is_active && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    /**
     * Check if this token has a specific scope.
     */
    public function hasScope(string $scope): bool
    {
        return in_array($scope, $this->scopes ?? []);
    }

    /**
     * Record that this token was used.
     */
    public function recordUsage(): void
    {
        $this->update(['last_used_at' => now()]);
    }

    /**
     * Revoke this token (deactivate it).
     */
    public function revoke(): void
    {
        $this->update(['is_active' => false]);
    }

    /**
     * Get the plain token value (only available during creation).
     * This is used to return the token to the user exactly once.
     */
    public function getPlainTokenAttribute(): ?string
    {
        return $this->attributes['plain_token'] ?? null;
    }
}
