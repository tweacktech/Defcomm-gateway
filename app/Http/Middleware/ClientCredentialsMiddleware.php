<?php

namespace App\Http\Middleware;

use App\Models\ApiClient;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class ClientCredentialsMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $clientId = $request->header('X-Client-Id', $request->input('client_id'));
        $clientSecret = $request->header('X-Client-Secret', $request->input('client_secret'));

        if (! $clientId || ! $clientSecret) {
            return response()->json([
                'message' => 'Unauthorized client.',
            ], 401);
        }

        $apiClient = ApiClient::query()
            ->where('client_id', $clientId)
            ->where('active', true)
            ->first();

        if (! $apiClient || ! Hash::check($clientSecret, $apiClient->client_secret)) {
            return response()->json([
                'message' => 'Invalid client credentials.',
            ], 401);
        }

        // Optionally make the resolved client available to controllers
        $request->attributes->set('api_client', $apiClient);

        return $next($request);
    }
}

