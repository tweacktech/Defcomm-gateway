<?php

use App\Http\Controllers\Api\PythonController;
use App\Http\Controllers\Api\VaultApiController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\DriveApiController;



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
        Route::get('/',            [DriveApiController::class, 'index'])->name('index');
        Route::get('/starred',     [DriveApiController::class, 'starred'])->name('starred');
        Route::get('/trash',       [DriveApiController::class, 'trash'])->name('trash');
        Route::get('/search',      [DriveApiController::class, 'search'])->name('search');
        Route::get('/usage',       [DriveApiController::class, 'usage'])->name('usage');
        Route::get('/items/{item}', [DriveApiController::class, 'show'])->name('items.show');

        // ── Write ─────────────────────────────────────────────────────────────
        Route::post('/folders',    [DriveApiController::class, 'createFolder'])->name('folders.create');
        Route::post('/upload',     [DriveApiController::class, 'upload'])->name('upload');

        // ── Mutations ─────────────────────────────────────────────────────────
        Route::patch('/items/{item}/rename', [DriveApiController::class, 'rename'])->name('items.rename');
        Route::patch('/items/{item}/move',   [DriveApiController::class, 'move'])->name('items.move');
        Route::patch('/items/{item}/star',   [DriveApiController::class, 'star'])->name('items.star');

        // ── Delete / Restore ──────────────────────────────────────────────────
        Route::delete('/items/{item}',         [DriveApiController::class, 'destroy'])->name('items.destroy');
        Route::post('/items/{id}/restore',     [DriveApiController::class, 'restore'])->name('items.restore');
        Route::delete('/items/{id}/force',     [DriveApiController::class, 'forceDelete'])->name('items.force-delete');

        // ── Download ──────────────────────────────────────────────────────────
        Route::get('/items/{item}/download',   [DriveApiController::class, 'download'])->name('items.download');
    });