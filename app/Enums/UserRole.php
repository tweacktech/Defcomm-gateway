<?php

namespace App\Enums;

enum UserRole: string
{
    case Super = 'super';
    case Admin = 'admin';
    case User = 'user';

    public function label(): string
    {
        return match ($this) {
            self::Super => 'Super Admin',
            self::Admin => 'Admin',
            self::User => 'User',
        };
    }

    public function isSuperAdmin(): bool
    {
        return $this === self::Super;
    }

    public function isCompanyAdmin(): bool
    {
        return $this === self::Admin;
    }

    public function isAtLeastCompanyAdmin(): bool
    {
        return $this === self::Super || $this === self::Admin;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
