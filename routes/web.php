<?php

use App\Http\Controllers\API\PythonController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DriveController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\VaultController;
use App\Models\Service;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    // return Inertia::render('welcome', [
    //     'canRegister' => Features::enabled(Features::registration()),
    // ]);
    return Inertia::render('auth/login');
})->name('home');

Route::prefix('')->middleware(['auth'])->group(function () {
    // dashboard
    Route::get('dashboard', [DashboardController::class, 'dashboard'])->name('dashboard');

    // route to generate access token for apiClients
    Route::get('access-token', [ProfileController::class, 'accessToken']);
    Route::post('generate-access-token', [ProfileController::class, 'genAccessToken']);

    // route for the vault service
    Route::get('/access-vault', [VaultController::class, 'index']);
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
        Route::get('/drive', [DriveController::class, 'index'])->name('drive.index');
        Route::get('/drive/folder/{folder}', [DriveController::class, 'index'])->name('drive.folder');
        Route::get('/drive/starred', [DriveController::class, 'starred'])->name('drive.starred');
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

    // ── Public share access — NO auth required ─────────────────────────────────────
    Route::get('/s/{token}', [DriveController::class, 'shareAccessPage'])->name('drive.share.access');
    Route::post('/s/{token}/unlock', [DriveController::class, 'unlockShare'])->name('drive.share.unlock');
    Route::get('/s/{token}/download', [DriveController::class, 'sharedDownload'])->name('drive.share.download');
})
->middleware(['auth', 'verified']);

Route::get('/run-python', [PythonController::class, 'run']);
Route::fallback(function () {
    return Inertia::render('error');
}
);

require __DIR__.'/settings.php';
