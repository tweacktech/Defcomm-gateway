<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'admin';
    case CompanyAdmin = 'company_admin';
    case Client = 'client';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::CompanyAdmin => 'Company Admin',
            self::Client => 'User',
        };
    }

    public function isSuperAdmin(): bool
    {
        return $this === self::SuperAdmin;
    }

    public function isCompanyAdmin(): bool
    {
        return $this === self::CompanyAdmin;
    }

    public function isAtLeastCompanyAdmin(): bool
    {
        return $this === self::SuperAdmin || $this === self::CompanyAdmin;
    }
}
