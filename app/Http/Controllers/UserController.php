<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Organization;
use App\Models\User;
use App\Services\UserInviteService;
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

    private const STATUSES = ['pending', 'active', 'block'];

    private const ROLES = ['user', 'admin', 'super'];

    // ── Pages ─────────────────────────────────────────────────────────────────

    /**
     * GET /admin/users — super admin only; lists every user.
     */
    public function index(Request $request): Response
    {
        $this->requireAdmin($request);

        $search = $request->input('search', '');
        $status = $request->input('status', 'all');
        $role = $request->input('role', 'all');

        $users = User::query()
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            }))
            ->when(in_array($status, self::STATUSES), fn ($q) => $q->where('status', $status))
            ->when(in_array($role, self::ROLES), fn ($q) => $q->where('role', $role))
            ->withCount(['tokens as tokens_count'])
            ->latest()
            ->paginate(20)
            ->through(fn ($u) => $this->userResource($u));

        return Inertia::render('admin/admin-users-index', [
            'users' => $users,
            'search' => $search,
            'status' => $status,
            'role' => $role,
            'summary' => $this->userSummary(),
            'organizations' => Organization::query()->orderBy('name')->get(['id', 'name']),
            'can_invite_super' => $request->user()->isGeneralAdmin(),
        ]);
    }

    /**
     * POST /admin/users/invite
     */
    public function invite(Request $request): RedirectResponse
    {
        $this->requireAdmin($request);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::in(self::ROLES)],
            'platform_role' => [
                Rule::requiredIf(fn () => $request->input('role') === 'super'),
                'nullable',
                Rule::in(['general_admin', 'billing', 'support', 'developer']),
            ],
            'organization_id' => [
                Rule::requiredIf(fn () => $request->input('role') !== 'super'),
                'nullable',
                'integer',
                'exists:organizations,id',
            ],
        ]);

        if ($validated['role'] === 'super' && ! $request->user()->isGeneralAdmin()) {
            return redirect()->back()->withErrors(['role' => 'Only general admins can invite super accounts.']);
        }

        $organization = null;
        if ($validated['role'] !== 'super') {
            $organization = Organization::query()->findOrFail($validated['organization_id']);
        }

        try {
            app(UserInviteService::class)->invite(
                $organization,
                $validated['email'],
                $validated['role'],
                $request->user(),
                $validated['name'] ?? null,
                $validated['platform_role'] ?? null,
            );
        } catch (\Throwable $e) {
            report($e);

            return redirect()->back()->withErrors([
                'email' => $e->getMessage() ?: 'Failed to send invitation.',
            ]);
        }

        $this->log('invited', "Invited {$validated['email']} as {$validated['role']}".(
            $validated['role'] === 'super' ? " ({$validated['platform_role']})" : ''
        ), 'auth');

        return redirect()->back()->with('success', $validated['role'] === 'super'
            ? "Invitation sent to {$validated['email']} as Super · ".str_replace('_', ' ', $validated['platform_role']).'.'
            : "Invitation sent to {$validated['email']}.");
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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['nullable', 'string'],
        ]);

        $data = [
            'name' => $validated['name'],
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
     * Set role: super | admin | user.
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
            'platform_role' => ['nullable', Rule::in(['general_admin', 'billing', 'support', 'developer'])],
        ]);

        if ($validated['role'] === 'super' && ! $request->user()->isGeneralAdmin()) {
            return redirect()->back()->withErrors(['role' => 'Only general admins can assign super roles.']);
        }

        $old = $user->role;
        $payload = [
            'role' => $validated['role'],
            'platform_role' => $validated['role'] === 'super'
                ? ($validated['platform_role'] ?? 'general_admin')
                : null,
        ];
        $user->update($payload);

        $this->log(
            'role_changed',
            "User {$user->email} role changed from {$old} to {$validated['role']}",
            'auth',
            $user
        );

        return redirect()->back()->with('success', "{$user->name} is now a {$validated['role']}.");
    }

    /**
     * PATCH /admin/users/{user}/subscription
     * Enable or disable subscription access for a user.
     */
    public function setSubscription(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        if ((int) $user->id === (int) $request->user()->id) {
            return redirect()->back()->withErrors([
                'subscription' => 'You cannot change your own subscription state.',
            ]);
        }

        $validated = $request->validate([
            'subscription_active' => ['required', 'boolean'],
            'plan_id' => ['nullable', 'integer', 'exists:user_plans,id'],
        ]);

        $user->update([
            'subscription_active' => $validated['subscription_active'],
            'plan_id' => $validated['plan_id'],
        ]);

        $this->log(
            'subscription_changed',
            "User {$user->email} subscription_active changed to {$validated['subscription_active']} and plan_id set to {$validated['plan_id']}",
            'auth',
            $user
        );

        return redirect()->back()->with('success', "{$user->name}'s subscription settings were updated.");
    }

    /**
     * PATCH /admin/users/{user}/status
     * Set status: pending | active | block.
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
     * Revoke ALL Sanctum tokens for this user.
     */
    public function revokeAllTokens(Request $request, User $user): RedirectResponse
    {
        $this->requireAdmin($request);

        $count = $user->tokens()->count();
        $user->tokens()->delete();

        $this->log(
            'token_revoked',
            "Revoked all {$count} API client(s) for {$user->email}",
            'auth',
            $user
        );

        return redirect()->back()->with('success', "{$count} token(s) revoked for {$user->name}.");
    }

    /**
     * DELETE /admin/users/{user}/tokens/{tokenId}
     * Revoke a single Sanctum token.
     */
    public function revokeSingleToken(Request $request, User $user, int $tokenId): RedirectResponse
    {
        $this->requireAdmin($request);

        $token = $user->tokens()->where('id', $tokenId)->firstOrFail();
        $token->delete();

        $this->log(
            'token_revoked',
            "Revoked token #{$tokenId} for {$user->email}",
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

        $user->tokens()->delete();
        $user->delete();

        $this->log('deleted', "Deleted user {$email}", 'auth');

        return redirect()->route('admin.users.index')
            ->with('success', "User {$email} deleted.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function requireAdmin(Request $request): void
    {
        if (! $request->user()?->isSuperAdmin()) {
            abort(403);
        }
    }

    public function userResource(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'role_label' => $user->roleLabel(),
            'platform_role' => $user->platform_role,
            'status' => $user->status,
            'token_count' => (int) ($user->tokens_count ?? $user->tokens()->count()),
            'created_at' => $user->created_at->toIso8601String(),
            'created_ago' => $user->created_at->diffForHumans(),
            'last_seen_at' => $user->last_seen_at?->toIso8601String(),
            'last_seen_ago' => $user->last_seen_at?->diffForHumans() ?? 'Never',
        ];
    }

    public function userSummary(): array
    {
        return [
            'total' => User::count(),
            'active' => User::where('status', UserStatus::Active->value)->count(),
            'pending' => User::where('status', UserStatus::Pending->value)->count(),
            'block' => User::where('status', UserStatus::Block->value)->count(),
            'supers' => User::where('role', UserRole::Super->value)->count(),
            'admins' => User::where('role', UserRole::Admin->value)->count(),
            'users' => User::where('role', UserRole::User->value)->count(),
            'new_this_week' => User::where('created_at', '>=', now()->subWeek())->count(),
        ];
    }
}
