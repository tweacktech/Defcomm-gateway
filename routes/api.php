<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\TranslatorController;
use App\Http\Controllers\Api\PythonController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');



Route::get('/run-python', [PythonController::class, 'run']);

Route::prefix('client')->group(function () {
    Route::post('/translate-text', [App\Http\Controllers\Api\TranslatorController::class, 'translateText']);
    Route::post('/translate-audio', [App\Http\Controllers\Api\TranslatorController::class, 'translateAudio']);
});
