<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class ServiceAuthMiddleware
{
    /**
     * Validates organization client credentials + user bearer token.
     *
     * Required headers:
     *   X-Client-Id      — company client ID (issued by organization)
     *   X-Client-Secret  — company client secret
     *   Authorization    — Bearer {user access token}
     */
    public function handle(Request $request, Closure $next): Response
    {
        $clientId = $request->header('X-Client-Id', $request->input('client_id'));
        $clientSecret = $request->header('X-Client-Secret', $request->input('client_secret'));

        if (! $clientId || ! $clientSecret) {
            return response()->json([
                'message' => 'Organization client credentials are required (X-Client-Id, X-Client-Secret).',
            ], 401);
        }

        $organization = Organization::query()
            ->where('client_id', $clientId)
            ->where('status', 'active')
            ->where('client_credentials_active', true)
            ->first();

        if (! $organization || ! Hash::check($clientSecret, $organization->client_secret)) {
            return response()->json([
                'message' => 'Invalid organization client credentials.',
            ], 401);
        }

        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'User bearer token is required (Authorization: Bearer {token}).',
            ], 401);
        }

        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'User account is not active.',
            ], 403);
        }

        if ((int) $user->organization_id !== (int) $organization->id && ! $user->isSuperAdmin()) {
            return response()->json([
                'message' => 'User is not authorized for this organization.',
            ], 403);
        }

        $request->attributes->set('organization', $organization);

        return $next($request);
    }
}
