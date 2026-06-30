<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    use \App\Traits\LogsActivity;

    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return to_route('profile.edit');
    }

    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        $this->log('logout', 'User logged logout', 'auth');

        Auth::logout();

        $user->tokens()->delete();
        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * Show organization credentials + user bearer token page.
     */
    public function accessToken(Request $request): Response
    {
        $user = $request->user()->load('organization');
        $organization = $user->organization;

        return Inertia::render('settings/token', [
            'organization' => $organization ? [
                'id' => $organization->id,
                'name' => $organization->name,
                'client_id' => $organization->client_id,
                'client_secret' => session('plain_client_secret'),
                'client_credentials_active' => $organization->client_credentials_active,
            ] : null,
            'access_token' => session('plain_access_token'),
            'can_manage_org_credentials' => $user->isAtLeastCompanyAdmin(),
            'role_label' => $user->roleLabel(),
        ]);
    }

    /**
     * Generate a Sanctum bearer token for the authenticated user.
     */
    public function genAccessToken(Request $request): RedirectResponse
    {
        try {
            $user = $request->user()->load('organization');

            if (! $user->organization?->client_credentials_active) {
                return redirect()->back()->with('error', 'Your organization has no active API credentials. Ask your company admin to generate them.');
            }

            $user->tokens()->where('name', 'api-access-token')->delete();

            $plainToken = $user->createToken('api-access-token')->plainTextToken;

            return redirect()->back()
                ->with('plain_access_token', $plainToken)
                ->with('success', 'Access token generated. Copy it now — it will not be shown again.');
        } catch (\Exception $e) {
            Log::error('Token generation failed: '.$e->getMessage());

            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function delAccessToken(Request $request): RedirectResponse
    {
        try {
            $user = $request->user();
            $user->tokens()->where('name', 'api-access-token')->delete();

            return redirect()->back()->with('success', 'Access token revoked successfully.');
        } catch (\Exception $e) {
            Log::error('Token deletion failed: '.$e->getMessage());

            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function document(Request $request): Response
    {
        return Inertia::render('document');
    }
}
