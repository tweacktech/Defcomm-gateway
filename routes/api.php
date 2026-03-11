<?php

use App\Http\Controllers\Api\PythonController;
use App\Http\Controllers\Api\VaultApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/run-python', [PythonController::class, 'run']);

Route::prefix('client')->group(function () {
    Route::post('/translate-text', [PythonController::class, 'translateText']);
    Route::post('/translate-audio', [PythonController::class, 'translateAudio']);
    Route::post('/text-translate-audio', [PythonController::class, 'textTranslateAudio']);
});
Route::prefix('client')->group(function () {
    Route::get('/vault', [VaultApiController::class, 'index']);
    Route::get('/vault/{id}', [VaultApiController::class, 'show']);
    Route::post('/vault', [VaultApiController::class, 'store']);
    Route::put('/vault/{id}', [VaultApiController::class, 'update']);
    Route::delete('/vault/{id}', [VaultApiController::class, 'destroy']);
   
});

