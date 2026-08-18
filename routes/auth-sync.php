<?php

use App\Http\Controllers\Auth\AlternateLoginController;
use App\Http\Controllers\Auth\CentralizedAuthController;
use App\Http\Controllers\Auth\WebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {

    // --- Alternate sign-in methods (unauthenticated, so keep these throttled) ---
    Route::post('/magic-link', [AlternateLoginController::class, 'sendMagicLink'])
        ->middleware('throttle:5,1')
        ->name('magic-link.send');
    Route::get('/magic-link/{token}', [AlternateLoginController::class, 'verifyMagicLink'])
        ->middleware('throttle:10,1')
        ->name('magic-link.verify');
    Route::post('/token-login', [AlternateLoginController::class, 'loginWithToken'])
        ->middleware('throttle:10,1')
        ->name('token-login');

    // --- OAuth2 consent flow (session-based, for the logged-in browser user) ---
    Route::get('/authorize', [CentralizedAuthController::class, 'authorizeForm'])->name('oauth.authorize.form');
    Route::post('/authorize', [CentralizedAuthController::class, 'authorize'])
        ->middleware('auth')
        ->name('oauth.authorize');

    // --- OAuth2 token exchange (client credentials in body, not session) ---
    Route::post('/token', [CentralizedAuthController::class, 'token'])
        ->middleware('throttle:30,1')
        ->name('oauth.token');

    // --- API token + webhook self-service management (session-based dashboard) ---
    Route::middleware('auth')->group(function () {
        Route::get('/api-tokens', [CentralizedAuthController::class, 'listApiTokens']);
        Route::post('/api-tokens', [CentralizedAuthController::class, 'createApiToken']);
        Route::delete('/api-tokens/{token}', [CentralizedAuthController::class, 'revokeApiToken']);

        Route::get('/webhooks', [WebhookController::class, 'index']);
        Route::post('/webhooks', [WebhookController::class, 'store']);
        Route::post('/webhooks/{webhook}/rotate-secret', [WebhookController::class, 'rotateSecret']);
        Route::delete('/webhooks/{webhook}', [WebhookController::class, 'destroy']);
    });

    // --- Public verification endpoints, called by external services ---
    Route::get('/verify-token', [CentralizedAuthController::class, 'verifyApiToken']);
    Route::get('/verify-oauth-token', [CentralizedAuthController::class, 'verifyOAuthToken']);

    // --- Bearer-token-authenticated endpoints for external services ---
    Route::middleware('api.token')->group(function () {
        Route::get('/me', [CentralizedAuthController::class, 'getMe']);
    });

    // Pull-based sync requires the elevated 'admin' scope on the API token.
    Route::get('/users/sync', [CentralizedAuthController::class, 'syncUsers'])
        ->middleware('api.token:admin');
});
