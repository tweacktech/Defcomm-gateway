<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class DriveShare extends Model
{
    protected $fillable = [
        'drive_item_id', 'owner_id', 'type', 'token',
        'permission', 'password', 'max_uses', 'use_count',
        'expires_at', 'recipient_id', 'transfer_status',
        'accepted_at', 'is_active',
    ];

    protected $casts = [
        'max_uses' => 'integer',
        'use_count' => 'integer',
        'is_active' => 'boolean',
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    protected $hidden = ['password'];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function driveItem(): BelongsTo
    {
        return $this->belongsTo(DriveItem::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    // ── Factories ─────────────────────────────────────────────────────────────

    /**
     * Build a new share-link record (not yet saved).
     *
     * The token is: base64url( encrypt( "itemId:randomBytes" ) )
     * This means the token is opaque and can't be guessed or enumerated.
     */
    public static function makeLink(
        DriveItem $item,
        string $permission = 'view',
        ?string $password = null,
        ?int $maxUses = null,
        ?\Carbon\Carbon $expiresAt = null,
    ): self {
        $payload = $item->id.':'.Str::random(32);
        $token = rtrim(strtr(base64_encode(Crypt::encryptString($payload)), '+/', '-_'), '=');

        return new self([
            'drive_item_id' => $item->id,
            'owner_id' => $item->user_id,
            'type' => 'link',
            'token' => substr($token, 0, 64),   // max col width
            'permission' => $permission,
            'password' => $password ? bcrypt($password) : null,
            'max_uses' => $maxUses,
            'expires_at' => $expiresAt,
            'is_active' => true,
        ]);
    }

    /**
     * Build a transfer record (not yet saved).
     */
    public static function makeTransfer(DriveItem $item, User $recipient): self
    {
        $payload = $item->id.':transfer:'.Str::random(32);
        $token = rtrim(strtr(base64_encode(Crypt::encryptString($payload)), '+/', '-_'), '=');

        return new self([
            'drive_item_id' => $item->id,
            'owner_id' => $item->user_id,
            'type' => 'transfer',
            'token' => substr($token, 0, 64),
            'permission' => 'download',
            'recipient_id' => $recipient->id,
            'transfer_status' => 'pending',
            'is_active' => true,
        ]);
    }

    // ── State helpers ─────────────────────────────────────────────────────────

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isExhausted(): bool
    {
        return $this->max_uses !== null && $this->use_count >= $this->max_uses;
    }

    /**
     * A share link is usable when: active, not expired, not exhausted.
     */
    public function isUsable(): bool
    {
        return $this->is_active && !$this->isExpired() && !$this->isExhausted();
    }

    public function hasPassword(): bool
    {
        return $this->password !== null;
    }

    /**
     * Increment use count and persist.
     */
    public function recordAccess(): void
    {
        $this->increment('use_count');
    }

    /**
     * Accept a pending transfer — reassigns item ownership.
     */
    public function acceptTransfer(): void
    {
        \DB::transaction(function () {
            // Reassign ownership of the item
            $this->driveItem->update([
                'user_id' => $this->recipient_id,
                'parent_id' => null,   // move to new owner's root
            ]);

            $this->update([
                'transfer_status' => 'accepted',
                'accepted_at' => now(),
                'is_active' => false,
            ]);
        });
    }

    /**
     * Decline a pending transfer.
     */
    public function declineTransfer(): void
    {
        $this->update([
            'transfer_status' => 'declined',
            'is_active' => false,
        ]);
    }
}
