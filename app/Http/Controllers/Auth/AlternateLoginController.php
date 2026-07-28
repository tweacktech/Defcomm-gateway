<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\MagicLinkMail;
use App\Models\ApiToken;
use App\Models\MagicLinkToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AlternateLoginController extends Controller
{
    private const MAGIC_LINK_TTL_MINUTES = 15;

    // =========================================================================
    // MAGIC LINK
    // =========================================================================

    /**
     * Request a magic sign-in link by email.
     *
     * POST /auth/magic-link
     * Body: { email }
     */
    public function sendMagicLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $user = User::where('email', $validated['email'])->first();

        // Always respond the same way whether or not the email exists,
        // so this endpoint can't be used to enumerate accounts.
        if ($user) {
            $plain = Str::random(48);

            MagicLinkToken::create([
                'user_id' => $user->id,
                'token' => hash('sha256', $plain),
                'expires_at' => now()->addMinutes(self::MAGIC_LINK_TTL_MINUTES),
                'requested_ip' => $request->ip(),
            ]);

            $url = url('/auth/magic-link/' . $plain);

            Mail::to($user->email)->send(new MagicLinkMail($url, self::MAGIC_LINK_TTL_MINUTES));
        }

        return response()->json([
            'message' => 'If that email has an account, a sign-in link is on its way.',
        ]);
    }

    /**
     * Consume a magic link and start a session.
     *
     * GET /auth/magic-link/{token}
     */
    public function verifyMagicLink(Request $request, string $token): RedirectResponse
    {
        $magicLink = MagicLinkToken::findValidByPlainText($token);

        if (!$magicLink) {
            return redirect()->route('login')
                ->with('error', 'That sign-in link is invalid or has expired. Please request a new one.');
        }

        $magicLink->update(['used_at' => now()]);

        auth()->login($magicLink->user, remember: true);
        $request->session()->regenerate();

        return redirect()->intended('/dashboard');
    }

    // =========================================================================
    // API TOKEN LOGIN
    // =========================================================================

    /**
     * Sign in using an API token that was explicitly created with
     * allow_interactive_login enabled. Regular integration tokens are
     * rejected, so a leaked read-only integration token can't be used
     * to open a full account session.
     *
     * POST /auth/token-login
     * Body: { token }
     */
    public function loginWithToken(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $apiToken = ApiToken::findValidByPlainText($validated['token']);

        if (!$apiToken || !$apiToken->allow_interactive_login) {
            return response()->json([
                'error' => 'invalid_token',
                'message' => 'This token is invalid, expired, or not enabled for sign-in.',
            ], 401);
        }

        $apiToken->recordUsage();

        auth()->login($apiToken->user, remember: true);
        $request->session()->regenerate();

        return redirect()->intended('/dashboard');
    }
}
