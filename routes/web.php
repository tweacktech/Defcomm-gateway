<?php

use App\Http\Controllers\API\PythonController;
use App\Http\Controllers\Settings\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::prefix('')->group(function () {
    // dashboard
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    //route to generate access token for apiClients
    Route::get('access-token', [ProfileController::class, 'accessToken']);
})->middleware(['auth', 'verified']);
Route::get('/run-python', [PythonController::class, 'run']);

require __DIR__.'/settings.php';
