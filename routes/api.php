<?php

use App\Http\Controllers\Api\AudioCallApiController;
use App\Http\Controllers\Api\AuthApiController;
use App\Http\Controllers\Api\ChatApiController;
use App\Http\Controllers\Api\DriveApiController;
use App\Http\Controllers\Api\FileSharesController;
use App\Http\Controllers\Api\MeetApiController;
use App\Http\Controllers\Api\PythonController;
use App\Http\Controllers\Api\VaultApiController;
use App\Http\Controllers\Auth\CentralizedAuthController;
use App\Http\Controllers\TurnCredentialController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Authentication — organization credentials + user bearer token
|--------------------------------------------------------------------------
|
| Flow:
|   1. Company admin generates client_id + client_secret on the organization
|   2. User obtains a personal bearer token (web UI or POST /api/auth/token)
|   3. Service calls include X-Client-Id, X-Client-Secret, Authorization: Bearer
|
*/

Route::prefix('auth')->name('api.auth.')->group(function () {
    Route::post('/token', [AuthApiController::class, 'token'])->name('token');

    Route::middleware(['auth:sanctum'])->group(function () {
        Route::get('/me', [AuthApiController::class, 'me'])->name('me');
        Route::post('/revoke', [AuthApiController::class, 'revoke'])->name('revoke');
    });
});

/*
|--------------------------------------------------------------------------
| Centralized Authentication — OAuth2 & API Tokens
|--------------------------------------------------------------------------
|
| OAuth2 Flow:
|   1. External service redirects user to /auth/authorize?client_id=...&redirect_uri=...&scope=...
|   2. User logs in and approves access
|   3. System redirects to redirect_uri?code=...&state=...
|   4. Service exchanges code for token: POST /auth/token
|
| API Token Flow:
|   1. User creates API token via /auth/api-tokens
|   2. External service uses token: Authorization: Bearer {token}
|   3. Service verifies token via GET /auth/verify-token
|
*/

Route::prefix('central-auth')->name('api.central-auth.')->group(function () {
    // Public endpoints (no auth required)
    Route::post('/token', [CentralizedAuthController::class, 'token'])->name('token');
    Route::get('/verify-token', [CentralizedAuthController::class, 'verifyApiToken'])->name('verify-token');
    Route::get('/verify-oauth', [CentralizedAuthController::class, 'verifyOAuthToken'])->name('verify-oauth');

    // Authenticated endpoints
    Route::middleware(['auth:sanctum'])->group(function () {
        Route::get('/me', [CentralizedAuthController::class, 'getMe'])->name('me');
        Route::get('/api-tokens', [CentralizedAuthController::class, 'listApiTokens'])->name('api-tokens.list');
        Route::post('/api-tokens', [CentralizedAuthController::class, 'createApiToken'])->name('api-tokens.create');
        Route::delete('/api-tokens/{token}', [CentralizedAuthController::class, 'revokeApiToken'])->name('api-tokens.revoke');
    });
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

/*
|--------------------------------------------------------------------------
| Chat API — push messages via service auth
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:sanctum', \App\Http\Middleware\ServiceAuthMiddleware::class])
    ->prefix('chat')
    ->name('api.chat.')
    ->group(function () {
        Route::post('/push', [ChatApiController::class, 'push'])->name('push');
        Route::get('/messages', [ChatApiController::class, 'messages'])->name('messages');
        Route::get('/conversations', [ChatApiController::class, 'conversations'])->name('conversations');
    });

Route::get('/run-python', [PythonController::class, 'run']);

Route::prefix('client')->middleware(['auth:sanctum', \App\Http\Middleware\ServiceAuthMiddleware::class])->group(function () {
    Route::post('/translate-text', [PythonController::class, 'translateText']);
    Route::post('/translate-audio', [PythonController::class, 'translateAudio']);
    Route::post('/text-translate-audio', [PythonController::class, 'textTranslateAudio']);
});
Route::prefix('client')->middleware(['auth:sanctum', \App\Http\Middleware\ServiceAuthMiddleware::class])->group(function () {
    Route::get('/vault', [VaultApiController::class, 'index']);
    Route::get('/vault/{id}', [VaultApiController::class, 'show']);
    Route::post('/vault', [VaultApiController::class, 'store']);
    Route::put('/vault/{id}', [VaultApiController::class, 'update']);
    Route::delete('/vault/{id}', [VaultApiController::class, 'destroy']);
});

Route::get('/audio/serve', [PythonController::class, 'serveAudio']);

/*
|--------------------------------------------------------------------------
| Drive API Routes
|--------------------------------------------------------------------------
|
| All routes are protected by Sanctum token authentication.
| Include this file in routes/api.php or paste the group directly.
|
| Base URL: /api/drive
|
| Quick reference:
|   GET    /api/drive                        → list folder contents (root or ?parent_id=)
|   GET    /api/drive/items/{id}             → single item metadata
|   GET    /api/drive/starred                → all starred items
|   GET    /api/drive/trash                  → trashed items
|   GET    /api/drive/search?q=              → full-drive search
|   GET    /api/drive/usage                  → storage bytes used
|
|   POST   /api/drive/folders                → create folder
|   POST   /api/drive/upload                 → upload files (multipart)
|
|   PATCH  /api/drive/items/{id}/rename      → rename
|   PATCH  /api/drive/items/{id}/move        → move to different folder
|   PATCH  /api/drive/items/{id}/star        → toggle starred
|
|   DELETE /api/drive/items/{id}             → soft delete (trash)
|   POST   /api/drive/items/{id}/restore     → restore from trash
|   DELETE /api/drive/items/{id}/force       → permanent delete (204)
|
|   GET    /api/drive/items/{id}/download    → binary download stream
|
*/

Route::prefix('drive')
    ->name('api.drive.')
    ->middleware(['auth:sanctum'])
    ->group(function () {
        // ── Read ─────────────────────────────────────────────────────────────
        Route::get('/', [DriveApiController::class, 'index'])->name('index');
        Route::get('/starred', [DriveApiController::class, 'starred'])->name('starred');
        Route::get('/trash', [DriveApiController::class, 'trash'])->name('trash');
        Route::get('/search', [DriveApiController::class, 'search'])->name('search');
        Route::get('/usage', [DriveApiController::class, 'usage'])->name('usage');
        Route::get('/items/{item}', [DriveApiController::class, 'show'])->name('items.show');

        // ── Write ─────────────────────────────────────────────────────────────
        Route::post('/folders', [DriveApiController::class, 'createFolder'])->name('folders.create');
        Route::post('/upload', [DriveApiController::class, 'upload'])->name('upload');

        // ── Mutations ─────────────────────────────────────────────────────────
        Route::patch('/items/{item}/rename', [DriveApiController::class, 'rename'])->name('items.rename');
        Route::patch('/items/{item}/move', [DriveApiController::class, 'move'])->name('items.move');
        Route::patch('/items/{item}/star', [DriveApiController::class, 'star'])->name('items.star');

        // ── Delete / Restore ──────────────────────────────────────────────────
        Route::delete('/items/{item}', [DriveApiController::class, 'destroy'])->name('items.destroy');
        Route::post('/items/{id}/restore', [DriveApiController::class, 'restore'])->name('items.restore');
        Route::delete('/items/{id}/force', [DriveApiController::class, 'forceDelete'])->name('items.force-delete');

        // ── Download ──────────────────────────────────────────────────────────
        Route::get('/items/{item}/download', [DriveApiController::class, 'download'])->name('items.download');
    });

// ─────────────────────────────────────────────────────────────────────────────
// SDK REST API — Sanctum token
// ─────────────────────────────────────────────────────────────────────────────

Route::middleware([\App\Modules\SecureDB\Middleware\SecureDbApiAuth::class])
    ->prefix('secure-db')
    ->name('api.secure-db.')
    ->group(function () {
        Route::post('/encrypt', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbApiController::class, 'encrypt'])->name('encrypt');
        Route::post('/decrypt', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbApiController::class, 'decrypt'])->name('decrypt');
        Route::post('/rotate', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbApiController::class, 'rotate'])->name('rotate');
        Route::get('/status', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbApiController::class, 'status'])->name('status');
    });

Route::prefix('secure-db/widget')
    ->name('api.secure-db.widget.')
    ->group(function () {
        Route::options('/{any?}', function () {
            return response('', 204)
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, X-Widget-Token');
        })->where('any', '.*');

        Route::post('/authenticate', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'authenticate'])->name('authenticate');

        Route::middleware([\App\Modules\SecureDB\Middleware\SecureDbWidgetSession::class])->group(function () {
            Route::get('/config', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'config'])->name('config');
            Route::get('/connection-status', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'connectionStatus'])->name('connection-status');
            Route::post('/connect', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'connectDatabase'])->name('connect');
            Route::post('/disconnect', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'disconnectDatabase'])->name('disconnect');
            Route::post('/encrypt', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'encryptValue'])->name('encrypt');
            Route::post('/encrypt-database', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'queueDatabaseEncryption'])->name('encrypt-database');
            Route::get('/audit-logs', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'auditLogs'])->name('audit-logs');
            Route::post('/logout', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'logout'])->name('logout');
        });
    });

Route::middleware(['auth:sanctum'])->prefix('api/meet')->name('api.meet.')->group(function () {
    Route::get('/rooms', [MeetApiController::class, 'listRooms'])->name('rooms.index');
    Route::post('/rooms', [MeetApiController::class, 'createRoom'])->name('rooms.create');
    Route::get('/rooms/{uid}', [MeetApiController::class, 'getRoom'])->name('rooms.show');
    Route::delete('/rooms/{uid}', [MeetApiController::class, 'endRoom'])->name('rooms.end');
    Route::post('/rooms/{uid}/token', [MeetApiController::class, 'issueToken'])->name('rooms.token');
});

// ─────────────────────────────────────────────────────────────────────────────
// SDK REST API — Sanctum token
// ─────────────────────────────────────────────────────────────────────────────

Route::middleware(['auth:sanctum'])->prefix('api/calls')->name('api.calls.')->group(function () {
    Route::get('/', [AudioCallApiController::class, 'list'])->name('index');
    Route::post('/', [AudioCallApiController::class, 'create'])->name('create');
    Route::get('/{uid}', [AudioCallApiController::class, 'show'])->name('show');
    Route::delete('/{uid}', [AudioCallApiController::class, 'end'])->name('end');
    Route::post('/{uid}/token', [AudioCallApiController::class, 'issueToken'])->name('token');
    Route::get('/{uid}/participants', [AudioCallApiController::class, 'participants'])->name('participants');
    Route::delete('/{uid}/participants/{peerId}', [AudioCallApiController::class, 'kick'])->name('participants.kick');
    Route::post('/{uid}/participants/{peerId}/admit', [AudioCallApiController::class, 'admit'])->name('participants.admit');
    Route::patch('/{uid}/priority', [AudioCallApiController::class, 'changePriority'])->name('priority');
});

// Add to routes/api.php
Route::get('/turn-credentials', TurnCredentialController::class);

// File CRUD operations - NO AUTH MIDDLEWARE, user_id passed as parameter
Route::apiResource('files', FileSharesController::class);

// File-specific operations
Route::get('files/{file}/download', [FileSharesController::class, 'download'])->name('files.download');
Route::get('files/{file}/preview', [FileSharesController::class, 'preview'])->name('files.preview');
Route::get('files/{file}/shares', [FileSharesController::class, 'getShares'])->name('files.shares.index');
Route::post('files/{file}/share', [FileSharesController::class, 'shareWith'])->name('files.share');

// Share management
Route::patch('shares/{share}', [FileSharesController::class, 'updateShare'])->name('shares.update');
Route::delete('shares/{share}', [FileSharesController::class, 'revokeShare'])->name('shares.destroy');

// User-centric views
Route::get('my-files', [FileSharesController::class, 'myFiles'])->name('files.my');
Route::get('shared-with-me', [FileSharesController::class, 'sharedWithMe'])->name('files.shared-with-me');
