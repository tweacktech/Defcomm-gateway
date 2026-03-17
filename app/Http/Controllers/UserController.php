<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    use LogsActivity;

    // ── Pages ─────────────────────────────────────────────────────────────────

    /**
     * GET /admin/users
     */
    public function index(Request $request): Response
    {
        $this->requireAdmin($request);

        $search = $request->input('search', '');

        $users = User::query()
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name',  'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            }))
            ->withCount('tokens')
            ->latest()
            ->paginate(20)
            ->through(fn ($u) => $this->userResource($u));

        return Inertia::render('admin/users/index', [
            'users'   => $users,
            'search'  => $search,
            'summary' => $this->userSummary(),
        ]);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * PATCH /admin/users/{user}
     * Update name, email, role, optional password.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        $validated = $request->validate([
            'name'                  => ['required', 'string', 'max:255'],
            'email'                 => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'password'              => ['nullable', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['nullable', 'string'],
            'is_admin'              => ['boolean'],
        ]);

        $data = [
            'name'     => $validated['name'],
            'email'    => $validated['email'],
            'is_admin' => $validated['is_admin'] ?? $user->is_admin,
        ];

        if (! empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        $this->log('updated', "Updated user {$user->email}", 'auth', $user);

        return redirect()->back()->with('success', "{$user->name} updated.");
    }

    /**
     * PATCH /admin/users/{user}/status
     * Toggle is_active — activate or deactivate the account.
     */
    public function toggleStatus(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        if ((int) $user->id === (int) $request->user()->id) {
            return redirect()->back()->withErrors([
                'status' => 'You cannot deactivate your own account.',
            ]);
        }

        $user->update(['is_active' => ! $user->is_active]);

        $action = $user->is_active ? 'activated' : 'deactivated';

        $this->log($action, "Account {$action} for {$user->email}", 'auth', $user);

        return redirect()->back()->with('success', "{$user->name} {$action}.");
    }

    /**
     * DELETE /admin/users/{user}/tokens
     * Revoke ALL Sanctum tokens (force logout from all devices).
     */
    public function revokeAllTokens(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        $count = $user->tokens()->count();
        $user->tokens()->delete();

        $this->log('token_revoked', "Revoked all {$count} token(s) for {$user->email}", 'auth', $user);

        return redirect()->back()->with('success', "{$count} token(s) revoked for {$user->name}.");
    }

    /**
     * DELETE /admin/users/{user}/tokens/{tokenId}
     * Revoke a single Sanctum token.
     */
    public function revokeSingleToken(Request $request, User $user, int $tokenId): RedirectResponse
    {
        $this->requireAdmin($request);

        $user->tokens()->findOrFail($tokenId)->delete();

        $this->log('token_revoked', "Revoked token #{$tokenId} for {$user->email}", 'auth', $user);

        return redirect()->back()->with('success', 'Token revoked.');
    }

    /**
     * DELETE /admin/users/{user}
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        if ((int) $user->id === (int) $request->user()->id) {
            return redirect()->back()->withErrors(['delete' => 'You cannot delete your own account.']);
        }

        $email = $user->email;
        $user->tokens()->delete();
        $user->delete();

        $this->log('deleted', "Deleted user {$email}", 'auth');

        return redirect()->route('admin.users.index')->with('success', "User {$email} deleted.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function requireAdmin(Request $request): void
    {
        if (! $request->user()?->role =='admin') {
            abort(403);
        }
    }

    public function userResource(User $user): array
    {
        return [
            'id'            => $user->id,
            'name'          => $user->name,
            'email'         => $user->email,
            'is_admin'      => (bool) $user->is_admin,
            'is_active'     => (bool) ($user->is_active ?? true),
            'token_count'   => $user->tokens_count ?? $user->tokens()->count(),
            'created_at'    => $user->created_at->toIso8601String(),
            'created_ago'   => $user->created_at->diffForHumans(),
            'last_seen_at'  => $user->last_seen_at?->toIso8601String(),
            'last_seen_ago' => $user->last_seen_at?->diffForHumans() ?? 'Never',
        ];
    }

    public function userSummary(): array
    {
        return [
            'total'         => User::count(),
            'active'        => User::where('is_active', true)->count(),
            'inactive'      => User::where('is_active', false)->count(),
            'admins'        => User::where('is_admin', true)->count(),
            'new_this_week' => User::where('created_at', '>=', now()->subWeek())->count(),
        ];
    }
}
