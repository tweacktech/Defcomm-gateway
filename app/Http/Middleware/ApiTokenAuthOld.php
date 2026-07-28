<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware for validating API token authentication.
 * External services use this to authenticate their requests.
 */
class ApiTokenAuthOld
{
    /**
     * Handle an incoming request.
     *
     * Usage in routes:
     *   Route::get('/api/protected', $callback)->middleware('api.token');
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'error' => 'missing_token',
                'message' => 'Authorization header required',
            ], 401);
        }

        $apiToken = DB::table('api_tokens')
            ->where('token', hash('sha256', $token))
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->first();

        if (!$apiToken) {
            return response()->json([
                'error' => 'invalid_token',
                'message' => 'Invalid or expired token',
            ], 401);
        }

        // Attach token info to request for later use
        $request->merge([
            'api_token' => $apiToken,
        ]);

        // Record token usage
        DB::table('api_tokens')
            ->where('id', $apiToken->id)
            ->update(['last_used_at' => now()]);

        return $next($request);
    }
}
