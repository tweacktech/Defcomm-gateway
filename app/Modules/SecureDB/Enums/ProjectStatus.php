<?php

namespace App\Modules\SecureDB\Enums;

enum ProjectStatus: string
{
    case Active = 'active';
    case Paused = 'paused';
    case Suspended = 'suspended';
    case Archived = 'archived';
}
