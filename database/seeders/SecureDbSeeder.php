<?php

namespace Database\Seeders;

use App\Modules\SecureDB\Models\SecureDbRole;
use App\Modules\SecureDB\Models\SecureDbSetting;
use Illuminate\Database\Seeder;

class SecureDbSeeder extends Seeder
{
    public function run(): void
    {
        foreach (SecureDbRole::defaultRoles() as $role) {
            SecureDbRole::updateOrCreate(
                ['slug' => $role['slug']],
                [
                    'name' => $role['name'],
                    'permissions' => $role['permissions'],
                    'description' => $role['name'] . ' role for Secure DB',
                ]
            );
        }

        $defaults = [
            'default_algorithm' => 'aes-256-gcm',
            'rotation_frequency' => 'daily',
            'retention_period_days' => 365,
            'audit_retention_days' => 730,
            'notification_channels' => ['in_app', 'email'],
        ];

        foreach ($defaults as $key => $value) {
            SecureDbSetting::setValue($key, $value);
        }
    }
}
