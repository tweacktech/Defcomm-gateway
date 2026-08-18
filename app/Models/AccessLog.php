<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessLog extends Model
{
    protected $fillable = [
        'drive_share_id',
        'ip_address',
        'user_agent',
        'browser',
        'os',
        'device',
        'country_code',
        'city',
        'extra_data',
    ];

    protected $casts = [
        'extra_data' => 'json',
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function driveShare(): BelongsTo
    {
        return $this->belongsTo(DriveShare::class);
    }

    // ── Factories ─────────────────────────────────────────────────────────────

    /**
     * Record an access log from the current request.
     */
    public static function recordAccess(DriveShare $share): self
    {
        return self::create([
            'drive_share_id' => $share->id,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'browser' => self::parseBrowser(request()->userAgent()),
            'os' => self::parseOs(request()->userAgent()),
            'device' => self::parseDevice(request()->userAgent()),
            'country_code' => self::getCountryCode(request()->ip()),
            'city' => self::getCity(request()->ip()),
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static function parseBrowser(?string $userAgent): ?string
    {
        if (!$userAgent) {
            return null;
        }

        if (stripos($userAgent, 'Chrome') !== false) {
            return 'Chrome';
        } elseif (stripos($userAgent, 'Safari') !== false && stripos($userAgent, 'Chrome') === false) {
            return 'Safari';
        } elseif (stripos($userAgent, 'Firefox') !== false) {
            return 'Firefox';
        } elseif (stripos($userAgent, 'Edge') !== false) {
            return 'Edge';
        } elseif (stripos($userAgent, 'Opera') !== false || stripos($userAgent, 'OPR') !== false) {
            return 'Opera';
        }

        return 'Other';
    }

    private static function parseOs(?string $userAgent): ?string
    {
        if (!$userAgent) {
            return null;
        }

        if (stripos($userAgent, 'Windows') !== false) {
            return 'Windows';
        } elseif (stripos($userAgent, 'Mac') !== false) {
            return 'macOS';
        } elseif (stripos($userAgent, 'Linux') !== false) {
            return 'Linux';
        } elseif (stripos($userAgent, 'iPhone') !== false || stripos($userAgent, 'iPad') !== false) {
            return 'iOS';
        } elseif (stripos($userAgent, 'Android') !== false) {
            return 'Android';
        }

        return 'Other';
    }

    private static function parseDevice(?string $userAgent): ?string
    {
        if (!$userAgent) {
            return null;
        }

        if (stripos($userAgent, 'Mobile') !== false || stripos($userAgent, 'iPhone') !== false) {
            return 'Mobile';
        } elseif (stripos($userAgent, 'Tablet') !== false || stripos($userAgent, 'iPad') !== false) {
            return 'Tablet';
        }

        return 'Desktop';
    }

    /**
     * Get country code from IP using GeoIP service.
     * You can integrate with MaxMind GeoIP2 or similar services.
     */
    private static function getCountryCode(?string $ip): ?string
    {
        if (!$ip) {
            return null;
        }

        // TODO: Integrate with GeoIP service
        // For now, return null
        return null;
    }

    /**
     * Get city from IP using GeoIP service.
     */
    private static function getCity(?string $ip): ?string
    {
        if (!$ip) {
            return null;
        }

        // TODO: Integrate with GeoIP service
        // For now, return null
        return null;
    }
}
