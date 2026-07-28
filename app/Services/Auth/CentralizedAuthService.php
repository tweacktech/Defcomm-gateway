<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Centralized Authentication Service
 * Handles OAuth2 and API token-based authentication for external services
 */
class CentralizedAuthService
{
    /**
     * Generate a new OAuth2 authorization code.
     * External services can exchange this code for an access token.
     *
     * @param User $user User to authorize
     * @param string $clientId OAuth2 client identifier
     * @param string $scope Space-separated list of scopes (e.g., "read write profile")
     * @param string $redirectUri Callback URI where authorization code is sent
     * @return string Authorization code
     */
    public static function generateAuthorizationCode(
        User $user,
        string $clientId,
        string $scope = 'read',
        string $redirectUri = ''
    ): string {
        $code = Str::random(40);

        DB::table('oauth_auth_codes')->insert([
            'user_id' => $user->id,
            'client_id' => $clientId,
            'code' => $code,
            'scopes' => $scope,
            'redirect_uri' => $redirectUri,
            'expires_at' => now()->addMinutes(10),
            'created_at' => now(),
        ]);

        return $code;
    }

    /**
     * Exchange an authorization code for an access token and refresh token.
     *
     * @param string $code Authorization code
     * @param string $clientId OAuth2 client ID
     * @param string $clientSecret OAuth2 client secret
     * @return array|null {access_token, refresh_token, expires_in, token_type}
     */
    public static function exchangeAuthorizationCode(
        string $code,
        string $clientId,
        string $clientSecret
    ): ?array {
        $authCode = DB::table('oauth_auth_codes')
            ->where('code', $code)
            ->where('client_id', $clientId)
            ->where('expires_at', '>', now())
            ->first();

        if (!$authCode) {
            return null;
        }

        // Verify client secret matches
        $client = DB::table('oauth_clients')
            ->where('id', $clientId)
            ->where('secret', hash('sha256', $clientSecret))
            ->first();

        if (!$client) {
            return null;
        }

        // Generate access and refresh tokens
        $accessToken = Str::random(80);
        $refreshToken = Str::random(80);
        $expiresIn = 3600; // 1 hour

        DB::transaction(function () use ($authCode, $accessToken, $refreshToken, $expiresIn) {
            // Save access token
            DB::table('oauth_access_tokens')->insert([
                'user_id' => $authCode->user_id,
                'client_id' => $authCode->client_id,
                'token' => hash('sha256', $accessToken),
                'scopes' => $authCode->scopes,
                'expires_at' => now()->addSeconds($expiresIn),
                'created_at' => now(),
            ]);

            // Save refresh token
            DB::table('oauth_refresh_tokens')->insert([
                'access_token_id' => DB::table('oauth_access_tokens')
                    ->where('token', hash('sha256', $accessToken))
                    ->value('id'),
                'token' => hash('sha256', $refreshToken),
                'expires_at' => now()->addDays(30),
                'created_at' => now(),
            ]);

            // Delete used authorization code
            DB::table('oauth_auth_codes')->where('code', $authCode->code)->delete();
        });

        return [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type' => 'Bearer',
            'expires_in' => $expiresIn,
        ];
    }

    /**
     * Validate an OAuth2 access token and return user if valid.
     *
     * @param string $token Access token
     * @return User|null
     */
    public static function validateAccessToken(string $token): ?User
    {
        $accessToken = DB::table('oauth_access_tokens')
            ->where('token', hash('sha256', $token))
            ->where('expires_at', '>', now())
            ->first();

        if (!$accessToken) {
            return null;
        }

        return User::find($accessToken->user_id);
    }

    /**
     * Refresh an expired access token using a refresh token.
     *
     * @param string $refreshToken Refresh token
     * @param string $clientId OAuth2 client ID
     * @return array|null {access_token, refresh_token, expires_in, token_type}
     */
    public static function refreshAccessToken(
        string $refreshToken,
        string $clientId
    ): ?array {
        $dbRefreshToken = DB::table('oauth_refresh_tokens')
            ->join('oauth_access_tokens', 'oauth_refresh_tokens.access_token_id', '=', 'oauth_access_tokens.id')
            ->where('oauth_refresh_tokens.token', hash('sha256', $refreshToken))
            ->where('oauth_refresh_tokens.expires_at', '>', now())
            ->where('oauth_access_tokens.client_id', $clientId)
            ->first();

        if (!$dbRefreshToken) {
            return null;
        }

        $newAccessToken = Str::random(80);
        $newRefreshToken = Str::random(80);
        $expiresIn = 3600;

        DB::transaction(function () use ($dbRefreshToken, $newAccessToken, $newRefreshToken, $expiresIn) {
            // Create new access token
            $newAccessTokenId = DB::table('oauth_access_tokens')->insertGetId([
                'user_id' => $dbRefreshToken->user_id,
                'client_id' => $dbRefreshToken->client_id,
                'token' => hash('sha256', $newAccessToken),
                'scopes' => $dbRefreshToken->scopes,
                'expires_at' => now()->addSeconds($expiresIn),
                'created_at' => now(),
            ]);

            // Create new refresh token
            DB::table('oauth_refresh_tokens')->insert([
                'access_token_id' => $newAccessTokenId,
                'token' => hash('sha256', $newRefreshToken),
                'expires_at' => now()->addDays(30),
                'created_at' => now(),
            ]);

            // Delete old tokens
            DB::table('oauth_refresh_tokens')->where('id', $dbRefreshToken->id)->delete();
            DB::table('oauth_access_tokens')->where('id', $dbRefreshToken->access_token_id)->delete();
        });

        return [
            'access_token' => $newAccessToken,
            'refresh_token' => $newRefreshToken,
            'token_type' => 'Bearer',
            'expires_in' => $expiresIn,
        ];
    }

    /**
     * Revoke an access token.
     *
     * @param string $token Access token to revoke
     */
    public static function revokeAccessToken(string $token): void
    {
        DB::table('oauth_access_tokens')
            ->where('token', hash('sha256', $token))
            ->delete();
    }
}
