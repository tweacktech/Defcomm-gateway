<?php

use App\Http\Controllers\API\PythonController;
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

Route::prefix('')->group(function () {
    // dashboard
    Route::get('dashboard', function () {
        $services = Service::get();

        return Inertia::render('dashboard', ['services' => $services]);
    })->name('dashboard');

    // route to generate access token for apiClients
    Route::get('access-token', [ProfileController::class, 'accessToken']);
    Route::post('generate-access-token', [ProfileController::class, 'genAccessToken']);

    // route for the vault service
    Route::get('/access-vault', [VaultController::class, 'index']);
    Route::get('/vault', [VaultController::class, 'index']);
    Route::get('/vault/{id}', [VaultController::class, 'show']);
    Route::get('/vault/{vaultItem}', [VaultController::class, 'show']);
    Route::post('/vault', [VaultController::class, 'store']);
    Route::put('/vault/{id}', [VaultController::class, 'update']);
    Route::delete('/vault/{id}', [VaultController::class, 'destroy']);

    Route::prefix('drive')->name('drive.')->middleware(['auth'])->group(function () {
        Route::get('/', [DriveController::class, 'index'])->name('index');
        Route::get('/folder/{folder}', [DriveController::class, 'index'])->name('folder');
        Route::get('/starred', [DriveController::class, 'starred'])->name('starred');
        Route::get('/trash', [DriveController::class, 'trash'])->name('trash');

        Route::post('/folders', [DriveController::class, 'createFolder'])->name('folders.create');
        Route::post('/upload', [DriveController::class, 'upload'])->name('upload');

        Route::patch('/items/{item}/rename', [DriveController::class, 'rename'])->name('items.rename');
        Route::patch('/items/{item}/move', [DriveController::class, 'move'])->name('items.move');
        Route::patch('/items/{item}/star', [DriveController::class, 'star'])->name('items.star');
        Route::delete('/items/{item}', [DriveController::class, 'destroy'])->name('items.destroy');
        Route::post('/items/{id}/restore', [DriveController::class, 'restore'])->name('items.restore');
        Route::delete('/items/{id}/force', [DriveController::class, 'forceDelete'])->name('items.force-delete');
        Route::get('/items/{item}/download', [DriveController::class, 'download'])->name('items.download');
    });
})->middleware(['auth', 'verified']);
Route::get('/run-python', [PythonController::class, 'run']);
Route::fallback(function () {
    return Inertia::render('error');
}
);

require __DIR__.'/settings.php';
