<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthApiController extends Controller
{
    /**
     * POST /api/auth/token
     * Exchange email/password + organization credentials for a user bearer token.
     */
    public function token(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['sometimes', 'string', 'max:255'],
        ]);

        $organization = $this->resolveOrganization($request);

        $user = User::query()
            ->where('email', $validated['email'])
            ->where('organization_id', $organization->id)
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->status !== 'active') {
            return response()->json(['message' => 'User account is not active.'], 403);
        }

        $tokenName = $validated['device_name'] ?? 'api-token';
        $plainToken = $user->createToken($tokenName)->plainTextToken;

        return response()->json([
            'message' => 'Authentication successful.',
            'access_token' => $plainToken,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'organization_id' => $user->organization_id,
            ],
            'organization' => [
                'id' => $organization->id,
                'name' => $organization->name,
                'client_id' => $organization->client_id,
            ],
        ]);
    }

    /**
     * POST /api/auth/revoke
     * Revoke the current bearer token.
     */
    public function revoke(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Token revoked.']);
    }

    /**
     * GET /api/auth/me
     * Return the authenticated user profile.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user()->load('organization');

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'role_label' => $user->roleLabel(),
                'organization_id' => $user->organization_id,
            ],
            'organization' => $user->organization ? [
                'id' => $user->organization->id,
                'name' => $user->organization->name,
                'client_id' => $user->organization->client_id,
            ] : null,
        ]);
    }

    private function resolveOrganization(Request $request): Organization
    {
        $clientId = $request->header('X-Client-Id', $request->input('client_id'));
        $clientSecret = $request->header('X-Client-Secret', $request->input('client_secret'));

        if (! $clientId || ! $clientSecret) {
            throw ValidationException::withMessages([
                'client_id' => ['Organization client credentials are required (X-Client-Id, X-Client-Secret).'],
            ]);
        }

        $organization = Organization::query()
            ->where('client_id', $clientId)
            ->where('status', 'active')
            ->where('client_credentials_active', true)
            ->first();

        if (! $organization || ! Hash::check($clientSecret, $organization->client_secret)) {
            throw ValidationException::withMessages([
                'client_id' => ['Invalid organization client credentials.'],
            ]);
        }

        return $organization;
    }
}
