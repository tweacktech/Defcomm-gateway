<?php

namespace App\Modules\SecureDB\Enums;

enum SecureDbPermission: string
{
    case View = 'view';
    case Create = 'create';
    case Edit = 'edit';
    case Delete = 'delete';
    case Encrypt = 'encrypt';
    case Decrypt = 'decrypt';
    case Rotate = 'rotate';
    case ApproveDevices = 'approve_devices';

    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }
}
