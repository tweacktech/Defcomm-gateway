<?php

namespace App\Enums;

enum SuperPlatformRole: string
{
    case GeneralAdmin = 'general_admin';
    case Billing = 'billing';
    case Support = 'support';
    case Developer = 'developer';

    public function label(): string
    {
        return match ($this) {
            self::GeneralAdmin => 'General Admin',
            self::Billing => 'Billing',
            self::Support => 'Support',
            self::Developer => 'Developer',
        };
    }

    /** @return list<string> */
    public function areas(): array
    {
        return match ($this) {
            self::GeneralAdmin => ['*'],
            self::Billing => ['dashboard', 'organizations', 'plans', 'users'],
            self::Support => ['dashboard', 'support', 'notifications', 'languages', 'agreements', 'system_mails'],
            self::Developer => ['dashboard', 'services', 'secure_db', 'store', 'bounty'],
        };
    }

    public function canAccess(string $area): bool
    {
        $areas = $this->areas();

        return in_array('*', $areas, true) || in_array($area, $areas, true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
