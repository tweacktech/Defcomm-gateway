<?php

use App\Http\Controllers\Api\MeetApiController;
use App\Http\Controllers\Api\PythonController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DriveController;
use App\Http\Controllers\MeetController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VaultController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    // return Inertia::render('welcome', [
    //     'canRegister' => Features::enabled(Features::registration()),
    // ]);
    return Inertia::render('auth/login');
})->name('home');

/*
|--------------------------------------------------------------------------
| Public Drive share links (guests — no authentication)
|--------------------------------------------------------------------------
*/
Route::get('/s/{token}', [DriveController::class, 'shareAccessPage'])->name('drive.share.access');
Route::post('/s/{token}/unlock', [DriveController::class, 'unlockShare'])->name('drive.share.unlock');
Route::get('/s/{token}/download', [DriveController::class, 'sharedDownload'])->name('drive.share.download');

Route::prefix('')->middleware(['auth'])->group(function () {
    // dashboard
    Route::get('dashboard', [DashboardController::class, 'dashboard'])->name('dashboard');

    // route to generate access token for apiClients
    Route::get('access-token', [ProfileController::class, 'accessToken']);
    Route::post('generate-access-token', [ProfileController::class, 'genAccessToken']);

    // route for the vault service
    Route::get('/services/vault', [VaultController::class, 'index']);
    Route::get('/vault', [VaultController::class, 'index']);
    Route::get('/vault/{vaultItem}', [VaultController::class, 'show']);
    Route::post('/vault', [VaultController::class, 'store']);
    Route::put('/vault/{vaultItem}', [VaultController::class, 'update']);
    Route::delete('/vault/{vaultItem}', [VaultController::class, 'destroy']);

    // Route::prefix('drive')->name('drive.')->middleware(['auth'])->group(function () {
    //     Route::get('/', [DriveController::class, 'index'])->name('index');
    //     Route::get('/folder/{folder}', [DriveController::class, 'index'])->name('folder');
    //     Route::get('/starred', [DriveController::class, 'starred'])->name('starred');
    //     Route::get('/trash', [DriveController::class, 'trash'])->name('trash');

    //     Route::post('/folders', [DriveController::class, 'createFolder'])->name('folders.create');
    //     Route::post('/upload', [DriveController::class, 'upload'])->name('upload');

    //     Route::patch('/items/{item}/rename', [DriveController::class, 'rename'])->name('items.rename');
    //     Route::patch('/items/{item}/move', [DriveController::class, 'move'])->name('items.move');
    //     Route::patch('/items/{item}/star', [DriveController::class, 'star'])->name('items.star');
    //     Route::delete('/items/{item}', [DriveController::class, 'destroy'])->name('items.destroy');
    //     Route::post('/items/{id}/restore', [DriveController::class, 'restore'])->name('items.restore');
    //     Route::delete('/items/{id}/force', [DriveController::class, 'forceDelete'])->name('items.force-delete');
    //     Route::get('/items/{item}/download', [DriveController::class, 'download'])->name('items.download');
    // });

    Route::middleware(['auth'])->group(function () {
        // ── Pages ──────────────────────────────────────────────────────────────────
        Route::get('/services/drive', [DriveController::class, 'index'])->name('drive.index');
        Route::get('/drive/folder/{folder}', [DriveController::class, 'index'])->name('drive.folder');
        Route::get('/drive/starred', [DriveController::class, 'starred'])->name('drive.starred');
        Route::get('/drive/transfers', [DriveController::class, 'transfers'])->name('drive.transfers'); // ← NEW
        Route::get('/drive/trash', [DriveController::class, 'trash'])->name('drive.trash');

        // ── Folder ─────────────────────────────────────────────────────────────────
        Route::post('/drive/folders', [DriveController::class, 'createFolder'])->name('drive.folders.create');

        // ── Upload ─────────────────────────────────────────────────────────────────
        Route::post('/drive/upload', [DriveController::class, 'upload'])->name('drive.upload');

        // ── Item mutations ─────────────────────────────────────────────────────────
        Route::patch('/drive/items/{item}/rename', [DriveController::class, 'rename'])->name('drive.items.rename');
        Route::patch('/drive/items/{item}/move', [DriveController::class, 'move'])->name('drive.items.move');
        Route::patch('/drive/items/{item}/star', [DriveController::class, 'star'])->name('drive.items.star');
        Route::delete('/drive/items/{item}', [DriveController::class, 'destroy'])->name('drive.items.destroy');
        Route::post('/drive/items/{id}/restore', [DriveController::class, 'restore'])->name('drive.items.restore');
        Route::delete('/drive/items/{id}/force', [DriveController::class, 'forceDelete'])->name('drive.items.force-delete');
        Route::get('/drive/items/{item}/download', [DriveController::class, 'download'])->name('drive.items.download');

        // ── Visibility ─────────────────────────────────────────────────────────────
        Route::patch('/drive/items/{item}/visibility', [DriveController::class, 'setVisibility'])->name('drive.items.visibility');

        // ── Share links ────────────────────────────────────────────────────────────
        Route::get('/drive/items/{item}/shares', [DriveController::class, 'listShares'])->name('drive.items.shares');
        Route::post('/drive/items/{item}/shares', [DriveController::class, 'createShareLink'])->name('drive.items.shares.create');
        Route::delete('/drive/shares/{share}', [DriveController::class, 'revokeShare'])->name('drive.shares.revoke');

        // ── Transfer (owner side) ──────────────────────────────────────────────────
        Route::post('/drive/items/{item}/transfer', [DriveController::class, 'initiateTransfer'])->name('drive.items.transfer');
        Route::delete('/drive/transfer/{token}/cancel', [DriveController::class, 'cancelTransfer'])->name('drive.transfer.cancel');

        // ── Transfer (recipient side — must be logged in) ──────────────────────────
        Route::get('/drive/transfer/{token}', [DriveController::class, 'transferPage'])->name('drive.transfer.page');
        Route::post('/drive/transfer/{token}/accept', [DriveController::class, 'acceptTransfer'])->name('drive.transfer.accept');
        Route::post('/drive/transfer/{token}/decline', [DriveController::class, 'declineTransfer'])->name('drive.transfer.decline');
    });

    // documentation page
    Route::get('/document', [ProfileController::class, 'document']);

    Route::middleware(['auth'])->prefix('admin')->name('admin.')->group(function () {
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::patch('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::patch('/users/{user}/role', [UserController::class, 'setRole'])->name('users.role');
        Route::patch('/users/{user}/status', [UserController::class, 'setStatus'])->name('users.status');
        Route::delete('/users/{user}/tokens', [UserController::class, 'revokeAllTokens'])->name('users.tokens.revoke-all');
        Route::delete('/users/{user}/tokens/{clientId}', [UserController::class, 'revokeSingleToken'])->name('users.tokens.revoke');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
    });

    Route::middleware(['auth'])->prefix('admin')->group(function () {
        Route::get('/services', [ServiceController::class, 'index'])->name('services.index');
        Route::post('/services', [ServiceController::class, 'store'])->name('services.store');
        Route::patch('/services/{service}', [ServiceController::class, 'update'])->name('services.update');
        Route::patch('/services/{service}/toggle', [ServiceController::class, 'toggle'])->name('services.toggle');
        Route::delete('/services/{service}', [ServiceController::class, 'destroy'])->name('services.destroy');
    });

    Route::get('/services/translator', [ServiceController::class, 'translator'])->name('translator');

    Route::get('/services/{key}', [ServiceController::class, 'serviceDetails'])->name('services.details')->middleware('auth');
});

// ═══════════════════════════════════════════════════════════════════════════════
// routes/meet.php  — add inside your routes/web.php with require
// ═══════════════════════════════════════════════════════════════════════════════

// // ── Internal Inertia routes (auth required) ────────────────────────────────
// Route::middleware(['auth'])->prefix('meet')->name('meet.')->group(function () {
//     Route::get('/',                          [MeetController::class, 'index'])->name('index');
//     Route::post('/rooms',                    [MeetController::class, 'create'])->name('create');
//     Route::get('/{uid}',                     [MeetController::class, 'room'])->name('room');
//     Route::post('/{uid}/password',           [MeetController::class, 'unlock'])->name('unlock');
//     Route::post('/{uid}/join',               [MeetController::class, 'join'])->name('join');
//     Route::post('/{uid}/leave',              [MeetController::class, 'leave'])->name('leave');
//     Route::post('/{uid}/signal',             [MeetController::class, 'signal'])->name('signal');
//     Route::patch('/{uid}/end',               [MeetController::class, 'end'])->name('end');
//     Route::patch('/{uid}/admit/{peerId}',    [MeetController::class, 'admit'])->name('admit');
// });

// Room page — controller decides view based on auth state + session
Route::get('/meet/{uid}', [MeetController::class, 'room'])->name('meet.room');

// Guest form submit (display_name + optional password)
Route::post('/meet/{uid}/guest', [MeetController::class, 'guestJoin'])->name('meet.guest.join');

// Participant JSON actions — auth optional, guests use peer_id from session
Route::post('/meet/{uid}/join', [MeetController::class, 'join'])->name('meet.join');
Route::post('/meet/{uid}/leave', [MeetController::class, 'leave'])->name('meet.leave');
Route::post('/meet/{uid}/signal', [MeetController::class, 'signal'])->name('meet.signal');

// ─────────────────────────────────────────────────────────────────────────────
// AUTH REQUIRED
// ─────────────────────────────────────────────────────────────────────────────

Route::middleware(['auth'])->prefix('meet')->name('meet.')->group(function () {
    Route::get('/', [MeetController::class, 'index'])->name('index');
    Route::post('/rooms', [MeetController::class, 'create'])->name('create');

    Route::post('/{uid}/password', [MeetController::class, 'unlock'])->name('unlock');
    Route::patch('/{uid}/end', [MeetController::class, 'end'])->name('end');
    Route::patch('/{uid}/admit/{peerId}', [MeetController::class, 'admit'])->name('admit');
    Route::patch('/{uid}/kick/{peerId}', [MeetController::class, 'kick'])->name('kick');
});

// ─────────────────────────────────────────────────────────────────────────────
// SDK REST API — Sanctum token
// ─────────────────────────────────────────────────────────────────────────────

Route::middleware(['auth:sanctum'])->prefix('api/meet')->name('api.meet.')->group(function () {
    Route::get('/rooms', [MeetApiController::class, 'listRooms'])->name('rooms.index');
    Route::post('/rooms', [MeetApiController::class, 'createRoom'])->name('rooms.create');
    Route::get('/rooms/{uid}', [MeetApiController::class, 'getRoom'])->name('rooms.show');
    Route::delete('/rooms/{uid}', [MeetApiController::class, 'endRoom'])->name('rooms.end');
    Route::post('/rooms/{uid}/token', [MeetApiController::class, 'issueToken'])->name('rooms.token');
});

Route::get('/audio/serve', [PythonController::class, 'serveAudio']);
Route::get('/run-python', [PythonController::class, 'run']);
Route::fallback(function () {
    return Inertia::render('error');
}
);

require __DIR__.'/settings.php';
