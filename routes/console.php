<?php

use App\Modules\SecureDB\Jobs\DeviceMonitoringJob;
use App\Modules\SecureDB\Jobs\HealthCheckJob;
use App\Modules\SecureDB\Jobs\RotateKeysJob;
use App\Modules\SecureDB\Models\SecureDbProject;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new HealthCheckJob)->everyFiveMinutes();
Schedule::job(new DeviceMonitoringJob)->hourly();

Schedule::call(function () {
    \App\Modules\SecureDB\Models\SecureDbConnection::where('health_status', 'healthy')->each(
        fn ($c) => \App\Modules\SecureDB\Jobs\SyncConnectionSchemaJob::dispatch($c)
    );
})->hourly();

Schedule::call(function () {
    SecureDbProject::where('status', 'active')->each(function ($project) {
        if ($project->rotation_interval === '5_minutes') {
            RotateKeysJob::dispatch($project);
        }
    });
})->everyFiveMinutes();

Schedule::call(function () {
    SecureDbProject::where('status', 'active')->where('rotation_interval', 'hourly')->each(
        fn($p) => RotateKeysJob::dispatch($p)
    );
})->hourly();

Schedule::call(function () {
    SecureDbProject::where('status', 'active')->where('rotation_interval', 'daily')->each(
        fn($p) => RotateKeysJob::dispatch($p)
    );
})->daily();

Schedule::call(function () {
    SecureDbProject::where('status', 'active')->where('rotation_interval', 'weekly')->each(
        fn($p) => RotateKeysJob::dispatch($p)
    );
})->weekly();

Schedule::call(function () {
    SecureDbProject::where('status', 'active')->where('rotation_interval', 'custom')
        ->whereNotNull('rotation_cron')
        ->each(fn($p) => RotateKeysJob::dispatch($p));
})->everyMinute();

Schedule::command('meet:send-reminders --minutes=10')->everyMinute();
