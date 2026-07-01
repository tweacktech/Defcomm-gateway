<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class ClientCredentialsMiddleware
{
    /**
     * Validate organization-level client credentials only (no user token).
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

        $organization = Organization::query()
            ->where('client_id', $clientId)
            ->where('status', 'active')
            ->where('client_credentials_active', true)
            ->first();

        if (! $organization || ! Hash::check($clientSecret, $organization->client_secret)) {
            return response()->json([
                'message' => 'Invalid client credentials.',
            ], 401);
        }

        $request->attributes->set('organization', $organization);

        return $next($request);
    }
}
