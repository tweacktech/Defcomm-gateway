<?php

use App\Http\Controllers\API\PythonController;
use App\Http\Controllers\Settings\ProfileController;
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

Route::prefix('')->group(function () {
    // dashboard
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // route to generate access token for apiClients
    Route::get('access-token', [ProfileController::class, 'accessToken']);
    Route::post('generate-access-token', [ProfileController::class, 'genAccessToken']);


    // route for the vault service
    Route::get('/access-vault', [VaultController::class, 'index']);
    Route::get('/vault/{id}', [VaultController::class, 'show']);
    Route::post('/vault', [VaultController::class, 'store']);
    Route::put('/vault/{id}', [VaultController::class, 'update']);
    Route::delete('/vault/{id}', [VaultController::class, 'destroy']);

    //
})->middleware(['auth', 'verified']);
Route::get('/run-python', [PythonController::class, 'run']);
Route::fallback(function () {
    return Inertia::render('error');
}
);

require __DIR__.'/settings.php';
