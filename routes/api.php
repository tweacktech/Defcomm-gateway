<?php

use App\Http\Controllers\Api\AudioCallApiController;
use App\Http\Controllers\Api\AuthApiController;
use App\Http\Controllers\Api\BountyApiController;
use App\Http\Controllers\Api\ChatApiController;
use App\Http\Controllers\Api\ContactsApiController;
use App\Http\Controllers\Api\DriveApiController;
use App\Http\Controllers\Api\EventsApiController;
use App\Http\Controllers\Api\FileSharesController;
use App\Http\Controllers\Api\MeetApiController;
use App\Http\Controllers\Api\MobileAuthApiController;
use App\Http\Controllers\Api\OrganizationServiceKeyController;
use App\Http\Controllers\Api\PythonController;
use App\Http\Controllers\Api\VaultApiController;
use App\Http\Controllers\Api\WalkieApiController;
use App\Http\Controllers\Auth\CentralizedAuthController;
use App\Http\Controllers\TurnCredentialController;
use App\Http\Middleware\ServiceAuthMiddleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Authentication — organization credentials + user bearer token
|--------------------------------------------------------------------------
|
| Service APIs also require a per-service key:
|   X-Client-Id, X-Client-Secret, Authorization: Bearer {user}, X-Service-Key: sdsk_...
|
*/

Route::prefix('auth')->name('api.auth.')->group(function () {
    Route::post('/token', [AuthApiController::class, 'token'])->name('token');

    Route::middleware(['auth:sanctum'])->group(function () {
        Route::get('/me', [AuthApiController::class, 'me'])->name('me');
        Route::post('/revoke', [AuthApiController::class, 'revoke'])->name('revoke');
    });
});

Route::prefix('central-auth')->name('api.central-auth.')->group(function () {
    Route::post('/token', [CentralizedAuthController::class, 'token'])->name('token');
    Route::get('/verify-token', [CentralizedAuthController::class, 'verifyApiToken'])->name('verify-token');
    Route::get('/verify-oauth', [CentralizedAuthController::class, 'verifyOAuthToken'])->name('verify-oauth');

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

$serviceStack = ['auth:sanctum', ServiceAuthMiddleware::class];

Route::middleware([...$serviceStack, 'service.key:chat'])
    ->prefix('chat')
    ->name('api.chat.')
    ->group(function () {
        Route::post('/push', [ChatApiController::class, 'push'])->name('push');
        Route::get('/messages', [ChatApiController::class, 'messages'])->name('messages');
        Route::get('/conversations', [ChatApiController::class, 'conversations'])->name('conversations');
    });

Route::get('/run-python', [PythonController::class, 'run']);

Route::prefix('client')->middleware([...$serviceStack, 'service.key:translator'])->group(function () {
    Route::post('/translate-text', [PythonController::class, 'translateText']);
    Route::post('/translate-audio', [PythonController::class, 'translateAudio']);
    Route::post('/text-translate-audio', [PythonController::class, 'textTranslateAudio']);
});

Route::prefix('client')->middleware([...$serviceStack, 'service.key:vault'])->group(function () {
    Route::get('/vault', [VaultApiController::class, 'index']);
    Route::get('/vault/{id}', [VaultApiController::class, 'show']);
    Route::post('/vault', [VaultApiController::class, 'store']);
    Route::put('/vault/{id}', [VaultApiController::class, 'update']);
    Route::delete('/vault/{id}', [VaultApiController::class, 'destroy']);
});

Route::get('/audio/serve', [PythonController::class, 'serveAudio']);

Route::prefix('drive')
    ->name('api.drive.')
    ->middleware([...$serviceStack, 'service.key:drive'])
    ->group(function () {
        Route::get('/', [DriveApiController::class, 'index'])->name('index');
        Route::get('/starred', [DriveApiController::class, 'starred'])->name('starred');
        Route::get('/trash', [DriveApiController::class, 'trash'])->name('trash');
        Route::get('/search', [DriveApiController::class, 'search'])->name('search');
        Route::get('/usage', [DriveApiController::class, 'usage'])->name('usage');
        Route::get('/items/{item}', [DriveApiController::class, 'show'])->name('items.show');
        Route::post('/folders', [DriveApiController::class, 'createFolder'])->name('folders.create');
        Route::post('/upload', [DriveApiController::class, 'upload'])->name('upload');
        Route::patch('/items/{item}/rename', [DriveApiController::class, 'rename'])->name('items.rename');
        Route::patch('/items/{item}/move', [DriveApiController::class, 'move'])->name('items.move');
        Route::patch('/items/{item}/star', [DriveApiController::class, 'star'])->name('items.star');
        Route::delete('/items/{item}', [DriveApiController::class, 'destroy'])->name('items.destroy');
        Route::post('/items/{id}/restore', [DriveApiController::class, 'restore'])->name('items.restore');
        Route::delete('/items/{id}/force', [DriveApiController::class, 'forceDelete'])->name('items.force-delete');
        Route::get('/items/{item}/download', [DriveApiController::class, 'download'])->name('items.download');
    });

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
                ->header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, X-Widget-Token');
        })->where('any', '.*');

        Route::post('/authenticate', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'authenticate'])->name('authenticate');

        Route::middleware([\App\Modules\SecureDB\Middleware\SecureDbWidgetSession::class])->group(function () {
            Route::get('/config', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'config'])->name('config');
            Route::get('/connection-status', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'connectionStatus'])->name('connection-status');
            Route::post('/connect', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'connectDatabase'])->name('connect');
            Route::post('/disconnect', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'disconnectDatabase'])->name('disconnect');
            Route::post('/encrypt', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'encryptValue'])->name('encrypt');
            Route::post('/decrypt', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'decryptValue'])->name('decrypt');
            Route::post('/encrypt-database', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'queueDatabaseEncryption'])->name('encrypt-database');
            Route::post('/decrypt-database', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'queueDatabaseDecryption'])->name('decrypt-database');
            Route::get('/jobs/{job}', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'jobStatus'])->name('jobs.show');
            Route::get('/encrypted-objects', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'encryptedObjects'])->name('encrypted-objects');
            Route::get('/audit-logs', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'auditLogs'])->name('audit-logs');
            Route::get('/app-keys', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'listAppKeys'])->name('app-keys.index');
            Route::post('/app-keys', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'storeAppKey'])->name('app-keys.store');
            Route::delete('/app-keys/{appKey}', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'revokeAppKey'])->name('app-keys.destroy');
            Route::post('/logout', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetApiController::class, 'logout'])->name('logout');
        });
    });

Route::prefix('secure-db/app')
    ->name('api.secure-db.app.')
    ->group(function () {
        Route::options('/{any?}', function () {
            return response('', 204)
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Secure-DB-App-Key');
        })->where('any', '.*');

        Route::middleware([\App\Modules\SecureDB\Middleware\SecureDbWidgetAppKeyAuth::class])->group(function () {
            Route::get('/tables', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetAppApiController::class, 'tables'])->name('tables');
            Route::match(['get', 'post'], '/query', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetAppApiController::class, 'query'])->name('query');
            Route::post('/decrypt', [\App\Modules\SecureDB\Http\Controllers\Api\SecureDbWidgetAppApiController::class, 'decrypt'])->name('decrypt');
        });
    });

Route::middleware([...$serviceStack, 'service.key:meet'])->prefix('meet')->name('api.meet.')->group(function () {
    Route::get('/rooms', [MeetApiController::class, 'listRooms'])->name('rooms.index');
    Route::post('/rooms', [MeetApiController::class, 'createRoom'])->name('rooms.create');
    Route::get('/rooms/{uid}', [MeetApiController::class, 'getRoom'])->name('rooms.show');
    Route::delete('/rooms/{uid}', [MeetApiController::class, 'endRoom'])->name('rooms.end');
    Route::post('/rooms/{uid}/token', [MeetApiController::class, 'issueToken'])->name('rooms.token');
});

Route::middleware([...$serviceStack, 'service.key:calls'])->prefix('calls')->name('api.calls.')->group(function () {
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

Route::get('/turn-credentials', TurnCredentialController::class)
    ->middleware([...$serviceStack, 'service.key:meet']);

Route::middleware([...$serviceStack, 'service.key:files'])->group(function () {
    Route::apiResource('files', FileSharesController::class);
    Route::get('files/{file}/download', [FileSharesController::class, 'download'])->name('files.download');
    Route::get('files/{file}/preview', [FileSharesController::class, 'preview'])->name('files.preview');
    Route::get('files/{file}/shares', [FileSharesController::class, 'getShares'])->name('files.shares.index');
    Route::post('files/{file}/share', [FileSharesController::class, 'shareWith'])->name('files.share');
    Route::patch('shares/{share}', [FileSharesController::class, 'updateShare'])->name('shares.update');
    Route::delete('shares/{share}', [FileSharesController::class, 'revokeShare'])->name('shares.destroy');
    Route::get('my-files', [FileSharesController::class, 'myFiles'])->name('files.my');
    Route::get('shared-with-me', [FileSharesController::class, 'sharedWithMe'])->name('files.shared-with-me');
});

Route::middleware([...$serviceStack])
    ->prefix('organization')
    ->name('api.organization.')
    ->group(function () {
        Route::get('/service-keys', [OrganizationServiceKeyController::class, 'index'])->name('service-keys.index');
        Route::post('/service-keys', [OrganizationServiceKeyController::class, 'store'])->name('service-keys.store');
        Route::delete('/service-keys/{serviceKey}', [OrganizationServiceKeyController::class, 'destroy'])->name('service-keys.destroy');
    });

Route::middleware([...$serviceStack, 'service.key:walkie'])
    ->prefix('walkie')
    ->name('api.walkie.')
    ->group(function () {
        Route::post('/channels', [WalkieApiController::class, 'createChannel']);
        Route::post('/channels/update', [WalkieApiController::class, 'updateChannel']);
        Route::delete('/channels/{id}', [WalkieApiController::class, 'deleteChannel']);
        Route::get('/channels', [WalkieApiController::class, 'listChannels']);
        Route::post('/channels/invite', [WalkieApiController::class, 'invite']);
        Route::get('/invites/{status}', [WalkieApiController::class, 'listInvites']);
        Route::post('/invites/status', [WalkieApiController::class, 'inviteStatus']);
        Route::post('/broadcast', [WalkieApiController::class, 'broadcast']);
        Route::get('/broadcast/{channelId}', [WalkieApiController::class, 'broadcastList']);
        Route::delete('/broadcast/{recordingId}', [WalkieApiController::class, 'broadcastDelete']);
        Route::post('/subscribers/join', [WalkieApiController::class, 'subscriberJoin']);
        Route::post('/subscribers/leave', [WalkieApiController::class, 'subscriberLeave']);
        Route::get('/subscribers/{channelId}/active', [WalkieApiController::class, 'subscriberActive']);
    });

Route::middleware([...$serviceStack, 'service.key:contacts'])
    ->prefix('contacts')
    ->name('api.contacts.')
    ->group(function () {
        Route::get('/groups', [ContactsApiController::class, 'groups']);
        Route::get('/groups/pending', [ContactsApiController::class, 'pendingGroups']);
        Route::post('/groups/{id}/accept', [ContactsApiController::class, 'acceptGroup']);
        Route::post('/groups/{id}/decline', [ContactsApiController::class, 'declineGroup']);
        Route::get('/groups/{id}/members', [ContactsApiController::class, 'groupMembers']);
        Route::get('/', [ContactsApiController::class, 'index']);
        Route::post('/{userId}', [ContactsApiController::class, 'add']);
        Route::delete('/{id}', [ContactsApiController::class, 'remove']);
    });

Route::prefix('mobile')
    ->name('api.mobile.')
    ->group(function () use ($serviceStack) {
        Route::middleware(['service.key:mobile_auth'])->group(function () {
            Route::post('/register', [MobileAuthApiController::class, 'register']);
            Route::post('/login', [MobileAuthApiController::class, 'login']);
            Route::post('/otp/request', [MobileAuthApiController::class, 'requestOtp']);
            Route::post('/otp/verify', [MobileAuthApiController::class, 'verifyOtp']);
            Route::post('/qr/create', [MobileAuthApiController::class, 'qrCreate']);
            Route::get('/qr/{code}/status', [MobileAuthApiController::class, 'qrStatus']);
            Route::post('/qr/{code}/exchange', [MobileAuthApiController::class, 'qrExchange']);
        });

        Route::middleware([...$serviceStack, 'service.key:mobile_auth'])->group(function () {
            Route::post('/qr/{code}/approve', [MobileAuthApiController::class, 'qrApprove']);
            Route::post('/heartbeat', [MobileAuthApiController::class, 'heartbeat']);
            Route::get('/devices', [MobileAuthApiController::class, 'devices']);
            Route::patch('/devices/{id}/status', [MobileAuthApiController::class, 'deviceStatus']);
            Route::post('/logout', [MobileAuthApiController::class, 'logout']);
        });
    });

Route::prefix('bounty')
    ->name('api.bounty.')
    ->middleware(['service.key:bounty'])
    ->group(function () {
        Route::post('/register', [BountyApiController::class, 'register']);
        Route::post('/verify', [BountyApiController::class, 'verify']);
        Route::post('/request-otp', [BountyApiController::class, 'requestOtp']);
        Route::post('/login', [BountyApiController::class, 'login']);
        Route::post('/login-verify', [BountyApiController::class, 'loginVerify']);
        Route::get('/leaderboard', [BountyApiController::class, 'leaderboard']);

        Route::middleware(['auth:sanctum'])->group(function () {
            Route::get('/profile', [BountyApiController::class, 'profile']);
            Route::get('/program', [BountyApiController::class, 'programs']);
            Route::get('/category', [BountyApiController::class, 'categories']);
            Route::post('/report', [BountyApiController::class, 'report']);
            Route::get('/report-log', [BountyApiController::class, 'reportLog']);
            Route::post('/logout', [BountyApiController::class, 'logout']);
        });
    });

Route::middleware([...$serviceStack, 'service.key:events'])
    ->prefix('events')
    ->name('api.events.')
    ->group(function () {
        Route::get('/', [EventsApiController::class, 'index']);
        Route::post('/register', [EventsApiController::class, 'register']);
        Route::get('/attendance', [EventsApiController::class, 'attendance']);
        Route::post('/attendance/clock', [EventsApiController::class, 'clock']);
        Route::get('/certificates', [EventsApiController::class, 'certificates']);
        Route::get('/souvenirs', [EventsApiController::class, 'souvenirs']);
    });
