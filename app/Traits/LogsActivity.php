<?php

namespace App\Traits;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;

/**
 * LogsActivity
 *
 * Drop this trait into any controller to get a one-liner logger.
 *
 * Usage inside a controller method:
 *
 *   $this->log('uploaded', "Uploaded {$file->name}", 'drive', $driveItem);
 *   $this->log('created',  "Created service {$service->name}", 'service', $service);
 *   $this->log('login',    'User logged in', 'auth');
 *
 * Or call the static method directly anywhere:
 *
 *   ActivityLog::record('deleted', 'Deleted vault item', 'vault', $item);
 */
trait LogsActivity
{
    protected function log(
        string  $event,
        string  $description,
        ?string $module  = null,
        ?Model  $subject = null,
        array   $extra   = [],
    ): void {
        ActivityLog::record($event, $description, $module, $subject, $extra);
    }
}
