<?php

use App\Modules\SecureDB\Http\Controllers\Admin\SecureDbAdminController;
use App\Modules\SecureDB\Http\Controllers\Admin\SecureDbConnectionController;
use App\Modules\SecureDB\Middleware\EnsureSecureDbAdmin;
use Illuminate\Support\Facades\Route;

Route::prefix('secure-db')
    ->middleware(['auth', EnsureSecureDbAdmin::class])
    ->name('secure-db.')
    ->group(function () {
        Route::get('/', [SecureDbAdminController::class, 'dashboard'])->name('dashboard');
        Route::get('/branding', [SecureDbAdminController::class, 'branding'])->name('branding');

        Route::get('/projects', [SecureDbAdminController::class, 'projects'])->name('projects');
        Route::post('/projects', [SecureDbAdminController::class, 'storeProject'])->name('projects.store');
        Route::patch('/projects/{project}', [SecureDbAdminController::class, 'updateProject'])->name('projects.update');
        Route::patch('/projects/{project}/archive', [SecureDbAdminController::class, 'archiveProject'])->name('projects.archive');
        Route::delete('/projects/{project}', [SecureDbAdminController::class, 'destroyProject'])->name('projects.destroy');
        Route::post('/projects/{project}/encrypt', [SecureDbAdminController::class, 'runEncryption'])->name('projects.encrypt');

        Route::get('/connections', [SecureDbAdminController::class, 'connections'])->name('connections');
        Route::post('/connections', [SecureDbAdminController::class, 'storeConnection'])->name('connections.store');
        Route::patch('/connections/{connection}', [SecureDbAdminController::class, 'updateConnection'])->name('connections.update');
        Route::post('/connections/{connection}/test', [SecureDbAdminController::class, 'testConnection'])->name('connections.test');
        Route::delete('/connections/{connection}', [SecureDbAdminController::class, 'destroyConnection'])->name('connections.destroy');

        Route::get('/connections/{connection}/explorer', [SecureDbConnectionController::class, 'explorer'])->name('connections.explorer');
        Route::post('/connections/{connection}/api/test', [SecureDbConnectionController::class, 'test'])->name('connections.api.test');
        Route::post('/connections/{connection}/api/sync', [SecureDbConnectionController::class, 'sync'])->name('connections.api.sync');
        Route::get('/connections/{connection}/api/schema', [SecureDbConnectionController::class, 'schema'])->name('connections.api.schema');
        Route::get('/connections/{connection}/api/objects/{object}/metadata', [SecureDbConnectionController::class, 'metadata'])->name('connections.api.metadata');
        Route::get('/connections/{connection}/api/objects/{object}/browse', [SecureDbConnectionController::class, 'browse'])->name('connections.api.browse');
        Route::get('/connections/{connection}/api/objects/{object}/export', [SecureDbConnectionController::class, 'export'])->name('connections.api.export');
        Route::get('/connections/{connection}/api/encryption-targets', [SecureDbConnectionController::class, 'encryptionTargets'])->name('connections.api.encryption-targets');
        Route::post('/connections/{connection}/api/encrypt', [SecureDbConnectionController::class, 'encrypt'])->name('connections.api.encrypt');
        Route::get('/connections/{connection}/api/encryption-jobs', [SecureDbConnectionController::class, 'encryptionJobs'])->name('connections.api.encryption-jobs');

        Route::get('/secure-widget', [\App\Modules\SecureDB\Http\Controllers\Admin\SecureDbWidgetController::class, 'index'])->name('secure-widget');
        Route::post('/widgets', [\App\Modules\SecureDB\Http\Controllers\Admin\SecureDbWidgetController::class, 'store'])->name('widgets.store');
        Route::post('/widgets/{widget}/regenerate-secret', [\App\Modules\SecureDB\Http\Controllers\Admin\SecureDbWidgetController::class, 'regenerateSecret'])->name('widgets.regenerate-secret');
        Route::get('/widgets/{widget}/embed-code', [\App\Modules\SecureDB\Http\Controllers\Admin\SecureDbWidgetController::class, 'embedCode'])->name('widgets.embed-code');
        Route::patch('/widgets/{widget}/toggle', [\App\Modules\SecureDB\Http\Controllers\Admin\SecureDbWidgetController::class, 'toggle'])->name('widgets.toggle');
        Route::delete('/widgets/{widget}', [\App\Modules\SecureDB\Http\Controllers\Admin\SecureDbWidgetController::class, 'destroy'])->name('widgets.destroy');

        Route::get('/policies', [SecureDbAdminController::class, 'policies'])->name('policies');
        Route::post('/policies', [SecureDbAdminController::class, 'storePolicy'])->name('policies.store');

        Route::get('/keys', [SecureDbAdminController::class, 'keys'])->name('keys');
        Route::post('/projects/{project}/rotate', [SecureDbAdminController::class, 'rotateKey'])->name('keys.rotate');
        Route::patch('/keys/{key}/revoke', [SecureDbAdminController::class, 'revokeKey'])->name('keys.revoke');

        Route::get('/devices', [SecureDbAdminController::class, 'devices'])->name('devices');
        Route::patch('/devices/{device}', [SecureDbAdminController::class, 'updateDeviceStatus'])->name('devices.update');

        Route::get('/audit-logs', [SecureDbAdminController::class, 'auditLogs'])->name('audit-logs');
        Route::get('/audit-logs/export/{format}', [SecureDbAdminController::class, 'exportAudit'])->name('audit-logs.export');

        Route::get('/notifications', [SecureDbAdminController::class, 'notifications'])->name('notifications');
        Route::patch('/notifications/{notification}/read', [SecureDbAdminController::class, 'markNotificationRead'])->name('notifications.read');

        Route::get('/reports', [SecureDbAdminController::class, 'reports'])->name('reports');
        Route::get('/settings', [SecureDbAdminController::class, 'settings'])->name('settings');
        Route::patch('/settings', [SecureDbAdminController::class, 'updateSettings'])->name('settings.update');

        Route::post('/health-check', [SecureDbAdminController::class, 'runHealthCheck'])->name('health-check');
    });
