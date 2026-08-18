<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\ApiToken;
use App\Models\OAuthClient;
use App\Models\User;
use App\Services\Auth\CentralizedAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Centralized Authentication Controller
 * Handles OAuth2 and API token authentication for external services
 */
class CentralizedAuthController extends Controller
{
    // =========================================================================
    // PAGES
    // =========================================================================

    /**
     * OAuth2 authorization page.
     * User logs in and approves access for external service.
     *
     * GET /auth/authorize?client_id=...&redirect_uri=...&scope=...&state=...
     */
    public function authorizeForm(Request $request): Response|RedirectResponse
    {
        $request->validate([
            'client_id' => 'required|exists:oauth_clients,id',
            'redirect_uri' => 'required|url',
            'scope' => 'required|string',
            'state' => 'required|string',
        ]);

        $client = OAuthClient::findOrFail($request->get('client_id'));

        if (!$client->is_active || !$client->hasRedirectUri($request->get('redirect_uri'))) {
            abort(403, 'This application is not authorized to use that redirect URI.');
        }

        // If already authenticated, show approval screen
        if ($request->user()) {
            return Inertia::render('auth/oauth-authorize', [
                'clientId' => $client->id,
                'clientName' => $client->name,
                'scope' => $request->get('scope'),
                'redirectUri' => $request->get('redirect_uri'),
                'state' => $request->get('state'),
            ]);
        }

        // Otherwise redirect to login with return URL
        return redirect()->route('login')->with('intended', $request->fullUrl());
    }

    /**
     * User approves OAuth2 access.
     * Generate authorization code and redirect to client.
     *
     * POST /auth/authorize
     */
    public function authorize(Request $request): RedirectResponse
    {
        $request->validate([
            'client_id' => 'required|exists:oauth_clients,id',
            'redirect_uri' => 'required|url',
            'scope' => 'required|string',
            'state' => 'required|string',
            'approve' => 'required|boolean',
        ]);

        $client = OAuthClient::findOrFail($request->get('client_id'));

        // Re-validate here too - never trust a redirect target carried only
        // in a form post, even one we rendered ourselves.
        if (!$client->is_active || !$client->hasRedirectUri($request->get('redirect_uri'))) {
            abort(403, 'This application is not authorized to use that redirect URI.');
        }

        if (!$request->boolean('approve')) {
            return redirect($request->get('redirect_uri'))
                ->with('error', 'Authorization denied');
        }

        $code = CentralizedAuthService::generateAuthorizationCode(
            $request->user(),
            $request->get('client_id'),
            $request->get('scope'),
            $request->get('redirect_uri')
        );

        $redirectUri = $request->get('redirect_uri')
            . (str_contains($request->get('redirect_uri'), '?') ? '&' : '?')
            . http_build_query([
                'code' => $code,
                'state' => $request->get('state'),
            ]);

        return redirect($redirectUri);
    }

    // =========================================================================
    // OAUTH2 TOKEN ENDPOINT
    // =========================================================================

    /**
     * Exchange authorization code for access token.
     *
     * POST /auth/token
     */
    public function token(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'grant_type' => 'required|in:authorization_code,refresh_token',
            'client_id' => 'required',
            'client_secret' => 'required',
        ]);

        if ($validated['grant_type'] === 'authorization_code') {
            $request->validate(['code' => 'required']);

            $response = CentralizedAuthService::exchangeAuthorizationCode(
                $request->get('code'),
                $request->get('client_id'),
                $request->get('client_secret')
            );

            if (!$response) {
                return response()->json([
                    'error' => 'invalid_grant',
                    'error_description' => 'Invalid authorization code',
                ], 400);
            }

            return response()->json($response);
        }

        if ($validated['grant_type'] === 'refresh_token') {
            $request->validate(['refresh_token' => 'required']);

            $response = CentralizedAuthService::refreshAccessToken(
                $request->get('refresh_token'),
                $request->get('client_id')
            );

            if (!$response) {
                return response()->json([
                    'error' => 'invalid_grant',
                    'error_description' => 'Invalid refresh token',
                ], 400);
            }

            return response()->json($response);
        }

        return response()->json(['error' => 'unsupported_grant_type'], 400);
    }

    // =========================================================================
    // API TOKEN MANAGEMENT
    // =========================================================================

    /**
     * List all API tokens for the authenticated user.
     *
     * GET /auth/api-tokens
     */
    public function listApiTokens(Request $request): JsonResponse
    {
        $tokens = ApiToken::where('user_id', $request->user()->id)
            ->select('id', 'name', 'scopes', 'last_used_at', 'expires_at', 'is_active', 'created_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $tokens]);
    }

    /**
     * Create a new API token.
     *
     * POST /auth/api-tokens
     * Body: { name, scopes: ["read","write"], expires_in_days: 365 }
     */
    public function createApiToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'scopes' => 'nullable|array|min:1',
            'scopes.*' => 'string|in:read,write,admin',
            'expires_in_days' => 'nullable|integer|min:1|max:3650',
            'allow_interactive_login' => 'nullable|boolean',
        ]);

        $token = ApiToken::issue(
            $request->user(),
            $validated['name'],
            $validated['scopes'] ?? ['read'],
            $validated['expires_in_days'] ?? null,
            $validated['allow_interactive_login'] ?? false
        );

        // The plaintext token is only ever available on this exact response -
        // it isn't recoverable afterward, since only its hash is stored.
        return response()->json([
            'data' => $token,
            'token' => $token->plainTextToken,
        ], 201);
    }

    /**
     * Revoke an API token.
     *
     * DELETE /auth/api-tokens/{token}
     */
    public function revokeApiToken(Request $request, ApiToken $token): JsonResponse
    {
        if ($token->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $token->revoke();

        return response()->json(['message' => 'Token revoked']);
    }

    // =========================================================================
    // PUBLIC ENDPOINTS (for external services)
    // =========================================================================

    /**
     * Verify an API token and return user info.
     *
     * GET /auth/verify-token
     * Header: Authorization: Bearer {token}
     */
    public function verifyApiToken(Request $request): JsonResponse
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'error' => 'missing_token',
                'message' => 'Authorization header missing',
            ], 401);
        }

        $apiToken = ApiToken::findValidByPlainText($token);

        if (!$apiToken) {
            return response()->json([
                'error' => 'invalid_token',
                'message' => 'Invalid or expired token',
            ], 401);
        }

        $apiToken->recordUsage();
        $user = $apiToken->user;

        return response()->json([
            'valid' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'scopes' => $apiToken->scopes,
        ]);
    }

    /**
     * Verify an OAuth2 access token.
     *
     * GET /auth/verify-oauth-token
     * Header: Authorization: Bearer {token}
     */
    public function verifyOAuthToken(Request $request): JsonResponse
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['error' => 'missing_token'], 401);
        }

        $user = CentralizedAuthService::validateAccessToken($token);

        if (!$user) {
            return response()->json(['error' => 'invalid_token'], 401);
        }

        return response()->json([
            'valid' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }

    /**
     * Get the authenticated user's profile.
     * Requires the `api.token` middleware (resolves user from Bearer token).
     *
     * GET /auth/me
     * Header: Authorization: Bearer {token}
     */
    public function getMe(Request $request): JsonResponse
    {
        return response()->json([
            'user' => [
                'id' => $request->user()->id,
                'name' => $request->user()->name,
                'email' => $request->user()->email,
                'avatar' => $request->user()->profile_photo_url ?? null,
            ],
        ]);
    }

    // =========================================================================
    // PULL-BASED USER SYNC (for external services)
    // =========================================================================

    /**
     * Return users changed since a given timestamp, for services that prefer
     * to pull rather than receive webhooks (e.g. on startup / backfill).
     * Requires an API token with the 'admin' scope.
     *
     * GET /auth/users/sync?since=2026-07-01T00:00:00Z&limit=100&cursor=...
     * Header: Authorization: Bearer {token}
     */
    public function syncUsers(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'since' => 'nullable|date',
            'limit' => 'nullable|integer|min:1|max:500',
            'cursor' => 'nullable|string', // opaque: "{updated_at}|{id}"
        ]);

        $limit = $validated['limit'] ?? 100;

        $query = User::query()
            ->select('id', 'name', 'email', 'updated_at')
            ->orderBy('updated_at')
            ->orderBy('id');

        if (!empty($validated['since'])) {
            $query->where('updated_at', '>=', $validated['since']);
        }

        if (!empty($validated['cursor'])) {
            [$cursorTime, $cursorId] = array_pad(explode('|', $validated['cursor'], 2), 2, null);
            if ($cursorTime && $cursorId) {
                $query->where(function ($q) use ($cursorTime, $cursorId) {
                    $q->where('updated_at', '>', $cursorTime)
                      ->orWhere(function ($q2) use ($cursorTime, $cursorId) {
                          $q2->where('updated_at', '=', $cursorTime)
                             ->where('id', '>', $cursorId);
                      });
                });
            }
        }

        $users = $query->limit($limit + 1)->get();
        $hasMore = $users->count() > $limit;
        $users = $users->take($limit);

        $nextCursor = null;
        if ($hasMore && $users->isNotEmpty()) {
            $last = $users->last();
            $nextCursor = $last->updated_at->toIso8601String() . '|' . $last->id;
        }

        return response()->json([
            'data' => $users->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'updated_at' => $u->updated_at->toIso8601String(),
            ]),
            'next_cursor' => $nextCursor,
            'has_more' => $hasMore,
        ]);
    }
}
