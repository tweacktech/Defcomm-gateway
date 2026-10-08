<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\UserInvitation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class InviteAcceptController extends Controller
{
    public function show(string $token): Response|RedirectResponse
    {
        $invitation = $this->findValid($token);
        if ($invitation instanceof RedirectResponse) {
            return $invitation;
        }

        return Inertia::render('auth/accept-invite', [
            'token' => $token,
            'email' => $invitation->email,
            'organization' => $invitation->organization?->only(['id', 'name']),
            'role' => $invitation->role,
            'platform_role' => $invitation->user?->platform_role,
            'role_label' => $invitation->user?->roleLabel() ?? $invitation->role,
        ]);
    }

    public function store(Request $request, string $token): RedirectResponse
    {
        $invitation = $this->findValid($token);
        if ($invitation instanceof RedirectResponse) {
            return $invitation;
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $user = $invitation->user;
        $user->update([
            'name' => $data['name'],
            'password' => Hash::make($data['password']),
            'status' => 'active',
            'email_verified_at' => $user->email_verified_at ?? now(),
        ]);

        $invitation->update([
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        Auth::login($user);

        return redirect()->route('dashboard')->with('success', 'Your account is ready.');
    }

    private function findValid(string $token): UserInvitation|RedirectResponse
    {
        $invitation = UserInvitation::query()
            ->with(['user', 'organization'])
            ->where('token', $token)
            ->first();

        if (! $invitation || $invitation->status === 'revoked') {
            return redirect()->route('login')->withErrors(['email' => 'This invitation is invalid.']);
        }

        if ($invitation->status === 'accepted') {
            return redirect()->route('login')->with('info', 'Invitation already accepted. Please sign in.');
        }

        if ($invitation->expires_at->isPast()) {
            $invitation->update(['status' => 'expired']);

            return redirect()->route('login')->withErrors(['email' => 'This invitation has expired.']);
        }

        return $invitation;
    }
}
