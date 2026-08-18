<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ApiToken extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'token',
        'scopes',
        'allow_interactive_login',
        'last_used_at',
        'expires_at',
        'is_active',
    ];

    protected $casts = [
        'scopes' => 'array',
        'allow_interactive_login' => 'boolean',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    // Hashed token is never serialized back to the client.
    protected $hidden = [
        'token',
    ];

    /**
     * Holds the plaintext token in memory right after issue().
     * Never persisted, never serialized - only readable on the instance
     * returned from issue() before it goes out of scope.
     */
    public ?string $plainTextToken = null;

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Create a new token for a user. Only place the plaintext token
     * exists outside the requester's original copy.
     */
    public static function issue(User $user, string $name, array $scopes = ['read'], ?int $expiresInDays = null, bool $allowInteractiveLogin = false): self
    {
        $plain = 'dct_' . Str::random(64);

        /** @var self $instance */
        $instance = static::query()->create([
            'user_id' => $user->id,
            'name' => $name,
            'token' => hash('sha256', $plain),
            'scopes' => $scopes,
            'allow_interactive_login' => $allowInteractiveLogin,
            'expires_at' => $expiresInDays ? now()->addDays($expiresInDays) : null,
            'is_active' => true,
        ]);

        $instance->plainTextToken = $plain;

        return $instance;
    }

    public static function findValidByPlainText(string $plain): ?self
    {
        return static::query()
            ->where('token', hash('sha256', $plain))
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->first();
    }

    public function revoke(): void
    {
        $this->update(['is_active' => false]);
    }

    public function recordUsage(): void
    {
        $this->update(['last_used_at' => now()]);
    }

    public function hasScope(string $scope): bool
    {
        $scopes = $this->scopes ?? [];

        return in_array($scope, $scopes, true) || in_array('admin', $scopes, true);
    }
}
