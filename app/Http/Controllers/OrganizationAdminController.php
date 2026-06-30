<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationAdminController extends Controller
{
    use LogsActivity;

    public function credentials(Request $request): Response
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);

        return Inertia::render('company/credentials', [
            'organization' => $this->organizationPayload($organization),
        ]);
    }

    public function users(Request $request): Response
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);
        $search = $request->input('search', '');
        $status = $request->input('status', 'all');
        $role = $request->input('role', 'all');

        $users = User::query()
            ->where('organization_id', $organization->id)
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            }))
            ->when(in_array($status, ['active', 'inactive', 'suspended']), fn ($q) => $q->where('status', $status))
            ->when(in_array($role, ['company_admin', 'client']), fn ($q) => $q->where('role', $role))
            ->withCount('tokens')
            ->latest()
            ->paginate(20)
            ->through(fn (User $u) => $this->userResource($u));

        return Inertia::render('company/users', [
            'organization' => $this->organizationPayload($organization),
            'users' => $users,
            'filters' => compact('search', 'status', 'role'),
            'summary' => [
                'total' => User::where('organization_id', $organization->id)->count(),
                'active' => User::where('organization_id', $organization->id)->where('status', 'active')->count(),
                'company_admins' => User::where('organization_id', $organization->id)->where('role', 'company_admin')->count(),
                'clients' => User::where('organization_id', $organization->id)->where('role', 'client')->count(),
            ],
        ]);
    }

    public function storeUser(Request $request): RedirectResponse
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', Rule::in(['company_admin', 'client'])],
        ]);

        User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'status' => 'active',
            'organization_id' => $organization->id,
        ]);

        $this->log('created', "Created user {$validated['email']} in {$organization->name}", 'auth');

        return redirect()->back()->with('success', 'User created successfully.');
    }

    public function updateUser(Request $request, User $user): RedirectResponse
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);
        $this->assertSameOrganization($organization, $user);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $data = [
            'name' => $validated['name'],
            'email' => $validated['email'],
        ];

        if (! empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        return redirect()->back()->with('success', "{$user->name} updated.");
    }

    public function setUserStatus(Request $request, User $user): RedirectResponse
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);
        $this->assertSameOrganization($organization, $user);

        if ((int) $user->id === (int) $request->user()->id) {
            return redirect()->back()->withErrors(['status' => 'You cannot change your own status.']);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in(['active', 'inactive', 'suspended'])],
        ]);

        $user->update(['status' => $validated['status']]);

        return redirect()->back()->with('success', "{$user->name} set to {$validated['status']}.");
    }

    public function generateCredentials(Request $request): RedirectResponse
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);

        $clientId = bin2hex(random_bytes(16));
        $plainSecret = bin2hex(random_bytes(32));

        $organization->update([
            'client_id' => $clientId,
            'client_secret' => Hash::make($plainSecret),
            'client_credentials_active' => true,
            'client_credentials_created_at' => now(),
        ]);

        $this->log(
            'org_credentials_generated',
            "Generated API credentials for organization {$organization->name}",
            'auth',
        );

        return redirect()
            ->back()
            ->with('plain_client_secret', $plainSecret)
            ->with('success', 'Organization credentials generated. Copy the client secret now — it will not be shown again.');
    }

    public function revokeCredentials(Request $request): RedirectResponse
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);

        $organization->update(['client_credentials_active' => false]);

        $this->log(
            'org_credentials_revoked',
            "Revoked API credentials for organization {$organization->name}",
            'auth',
        );

        return redirect()->back()->with('success', 'Organization credentials deactivated.');
    }

    public function setUserRole(Request $request, User $user): RedirectResponse
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);
        $this->assertSameOrganization($organization, $user);

        if ($user->isSuperAdmin()) {
            return redirect()->back()->withErrors(['role' => 'Cannot change role of a super admin.']);
        }

        if ((int) $user->id === (int) $request->user()->id) {
            return redirect()->back()->withErrors(['role' => 'You cannot change your own role.']);
        }

        $validated = $request->validate([
            'role' => ['required', 'in:company_admin,client'],
        ]);

        $user->update(['role' => $validated['role']]);

        $this->log('role_changed', "Changed {$user->email} role to {$validated['role']}", 'auth', $user);

        return redirect()->back()->with('success', "{$user->name} is now a {$validated['role']}.");
    }

    public function revokeUserTokens(Request $request, User $user): RedirectResponse
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);
        $this->assertSameOrganization($organization, $user);

        $count = $user->tokens()->count();
        $user->tokens()->delete();

        return redirect()->back()->with('success', "Revoked {$count} token(s) for {$user->name}.");
    }

    private function organizationPayload(Organization $organization): array
    {
        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'client_id' => $organization->client_id,
            'client_secret' => session('plain_client_secret'),
            'client_credentials_active' => $organization->client_credentials_active,
            'client_credentials_created_at' => $organization->client_credentials_created_at?->toIso8601String(),
        ];
    }

    private function userResource(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'role_label' => $user->roleLabel(),
            'status' => $user->status,
            'token_count' => (int) ($user->tokens_count ?? 0),
            'created_at' => $user->created_at->toIso8601String(),
        ];
    }

    private function requireCompanyAdmin(Request $request): void
    {
        $user = $request->user();

        if (! $user || (! $user->isSuperAdmin() && ! $user->isCompanyAdmin())) {
            abort(403);
        }
    }

    private function resolveOrganization(Request $request): Organization
    {
        $user = $request->user();

        if ($user->isSuperAdmin() && $request->filled('organization_id')) {
            return Organization::findOrFail($request->integer('organization_id'));
        }

        if (! $user->organization_id) {
            abort(422, 'You are not assigned to an organization.');
        }

        return Organization::findOrFail($user->organization_id);
    }

    private function assertSameOrganization(Organization $organization, User $user): void
    {
        if ((int) $user->organization_id !== (int) $organization->id) {
            abort(403, 'User does not belong to your organization.');
        }
    }
}
