<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiTokenAuth
{
    /**
     * Usage in routes: ->middleware('api.token') or ->middleware('api.token:admin')
     */
    public function handle(Request $request, Closure $next, ?string $requiredScope = null): Response
    {
        $bearer = $request->bearerToken();

        if (!$bearer) {
            return response()->json([
                'error' => 'missing_token',
                'message' => 'Authorization header missing',
            ], 401);
        }

        $apiToken = ApiToken::findValidByPlainText($bearer);

        if (!$apiToken) {
            return response()->json([
                'error' => 'invalid_token',
                'message' => 'Invalid or expired token',
            ], 401);
        }

        if ($requiredScope && !$apiToken->hasScope($requiredScope)) {
            return response()->json([
                'error' => 'insufficient_scope',
                'message' => "This action requires the '{$requiredScope}' scope",
            ], 403);
        }

        $apiToken->recordUsage();

        $request->setUserResolver(fn () => $apiToken->user);
        $request->attributes->set('api_token', $apiToken);

        return $next($request);
    }
}
