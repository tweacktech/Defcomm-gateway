<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\ApiClient;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use App\Models\Service;
use Inertia\Response;

class ProfileController extends Controller
{
    public function dashboard()
    {
        $user = Auth::user();
        $service = Service::get();
        if ($user->is_admin) {
            return Inertia::render('admin/dashboard', [
                'service' => $service,
            ]);
        } else {
            return Inertia::render('dashboard', [
                'service' => $service,
            ]);
        }
    }

    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * Delete the user's profile.
     */
    public function accessToken(Request $request)
    {
        $user = $request->user();
        $client_details = ApiClient::where('user_id', $user->id)->first();
        if (empty($client_details)) {
            $client_details = null;
        }

        return Inertia::render('settings/token', ['client' => $client_details]);
    }

    public function genAccessToken(Request $request)
    {
        try {
            $user = $request->user();

            // return $request->all();

            if (ApiClient::where('user_id', $user->id)->exists()) {
                return redirect()->back()->withErrors(['error' => 'Client ID already exists. Please try again.']);
            }
            $client_id = bin2hex(random_bytes(16));
            $client_secret = bin2hex(random_bytes(32));

            $client_details = ApiClient::create([
                'user_id' => $user->id,
                'name' => $user->name,
                'client_id' => $client_id,
                'client_secret' => $client_secret,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(), ]);

            if (empty($client_details)) {
                $client_details = null;
            }

            return Inertia::render('settings/token', ['client' => $client_details]);
        } catch (\Exception $e) {
            Log::error('message'.$e->getMessage());

            return redirect()->back();
        }
    }

    // Delet the generated token.
    public function delAccessToken(Request $request)
    {
        try {
            $user = $request->user();
            if (ApiClient::where('user_id', $user->id)->exists()) {
                ApiClient::where('user_id', $user->id)->delete();

                return redirect()->back()->with('status', 'Access token deleted successfully.');
            } else {
                return redirect()->back()->withErrors(['error' => 'Client ID already exists. Please try again.']);
            }

            // return Inertia::render('settings/token');
        } catch (\Exception $e) {
            Log::error('message'.$e->getMessage());

            return redirect()->back();
        }
    }
}
