<?php

namespace App\Http\Controllers;

use App\Models\ApiClient;
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

    private const STATUSES = ['active', 'inactive', 'suspended'];
    private const ROLES    = ['admin', 'client'];

    // ── Pages ─────────────────────────────────────────────────────────────────

    /**
     * GET /admin/users
     */
    public function index(Request $request): Response
    {
        $this->requireAdmin($request);

        $search = $request->input('search', '');
        $status = $request->input('status', 'all');
        $role   = $request->input('role', 'all');

        $users = User::query()
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name',  'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            }))
            ->when(in_array($status, self::STATUSES), fn ($q) => $q->where('status', $status))
            ->when(in_array($role, self::ROLES),      fn ($q) => $q->where('role', $role))
            ->withCount('apiClients as tokens_count')
            ->latest()
            ->paginate(20)
            ->through(fn ($u) => $this->userResource($u));

        return Inertia::render('admin/admin-users-index', [
            'users'   => $users,
            'search'  => $search,
            'status'  => $status,
            'role'    => $role,
            'summary' => $this->userSummary(),
        ]);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * PATCH /admin/users/{user}
     * Update name and email. Password optional.
     */
    public function update(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        $validated = $request->validate([
            'name'                  => ['required', 'string', 'max:255'],
            'email'                 => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'password'              => ['nullable', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['nullable', 'string'],
        ]);

        $data = [
            'name'  => $validated['name'],
            'email' => $validated['email'],
        ];

        if (! empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        $this->log('updated', "Updated user {$user->email}", 'auth', $user);

        return redirect()->back()->with('success', "{$user->name} updated.");
    }

    /**
     * PATCH /admin/users/{user}/role
     * Set role: admin | client.
     */
    public function setRole(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        // Prevent admin from demoting themselves
        if ((int) $user->id === (int) $request->user()->id) {
            return redirect()->back()->withErrors([
                'role' => 'You cannot change your own role.',
            ]);
        }

        $validated = $request->validate([
            'role' => ['required', Rule::in(self::ROLES)],
        ]);

        $old = $user->role;
        $user->update(['role' => $validated['role']]);

        $this->log(
            'role_changed',
            "User {$user->email} role changed from {$old} to {$validated['role']}",
            'auth',
            $user
        );

        return redirect()->back()->with('success', "{$user->name} is now a {$validated['role']}.");
    }

    /**
     * PATCH /admin/users/{user}/status
     * Set status: active | inactive | suspended.
     */
    public function setStatus(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        if ((int) $user->id === (int) $request->user()->id) {
            return redirect()->back()->withErrors([
                'status' => 'You cannot change the status of your own account.',
            ]);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
        ]);

        $old = $user->status;
        $user->update(['status' => $validated['status']]);

        $this->log(
            'status_changed',
            "User {$user->email} status changed from {$old} to {$validated['status']}",
            'auth',
            $user
        );

        return redirect()->back()->with('success', "{$user->name} set to {$validated['status']}.");
    }

    /**
     * DELETE /admin/users/{user}/tokens
     * Deactivate + delete ALL ApiClient tokens for this user.
     */
    public function revokeAllTokens(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        $count = $user->apiClients()->count();

        $user->apiClients()->update(['active' => false]);
        $user->apiClients()->delete();

        $this->log(
            'token_revoked',
            "Revoked all {$count} API client(s) for {$user->email}",
            'auth',
            $user
        );

        return redirect()->back()->with('success', "{$count} token(s) revoked for {$user->name}.");
    }

    /**
     * DELETE /admin/users/{user}/tokens/{clientId}
     * Revoke a single ApiClient token.
     */
    public function revokeSingleToken(Request $request, User $user, int $clientId): RedirectResponse
    {
        $this->requireAdmin($request);

        $client = ApiClient::where('user_id', $user->id)->findOrFail($clientId);

        $client->update(['active' => false]);
        $client->delete();

        $this->log(
            'token_revoked',
            "Revoked API client #{$clientId} for {$user->email}",
            'auth',
            $user
        );

        return redirect()->back()->with('success', 'Token revoked.');
    }

    /**
     * DELETE /admin/users/{user}
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        if ((int) $user->id === (int) $request->user()->id) {
            return redirect()->back()->withErrors([
                'delete' => 'You cannot delete your own account.',
            ]);
        }

        $email = $user->email;

        $user->apiClients()->delete();
        $user->delete();

        $this->log('deleted', "Deleted user {$email}", 'auth');

        return redirect()->route('admin.users.index')
            ->with('success', "User {$email} deleted.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function requireAdmin(Request $request): void
    {
        if ($request->user()?->role !== 'admin') {
            abort(403);
        }
    }

    public function userResource(User $user): array
    {
        return [
            'id'            => $user->id,
            'name'          => $user->name,
            'email'         => $user->email,
            'role'          => $user->role,             // 'admin' | 'client'
            'status'        => $user->status,           // 'active' | 'inactive' | 'suspended'
            'token_count'   => (int) ($user->tokens_count ?? $user->apiClients()->count()),
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
            'active'        => User::where('status', 'active')->count(),
            'inactive'      => User::where('status', 'inactive')->count(),
            'suspended'     => User::where('status', 'suspended')->count(),
            'admins'        => User::where('role', 'admin')->count(),
            'clients'       => User::where('role', 'client')->count(),
            'new_this_week' => User::where('created_at', '>=', now()->subWeek())->count(),
        ];
    }
}
