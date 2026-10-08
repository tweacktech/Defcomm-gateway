<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\Service;
use App\Models\User;
use App\Services\OrganizationServiceKeyService;
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
        $keys = app(OrganizationServiceKeyService::class)->listForOrganization($organization);

        return Inertia::render('company/credentials', [
            'organization' => $this->organizationPayload($organization),
            'services' => Service::query()->where('is_active', true)->orderBy('name')->get(['id', 'key', 'name', 'description']),
            'serviceKeys' => $keys,
            'plain_service_key' => session('plain_service_key'),
        ]);
    }

    public function generateServiceKey(Request $request): RedirectResponse
    {
        $this->requireCompanyAdmin($request);
        $organization = $this->resolveOrganization($request);

        $validated = $request->validate([
            'service_key' => ['required', 'string', 'exists:services,key'],
            'name' => ['required', 'string', 'max:120'],
        ]);

        $service = Service::query()->where('key', $validated['service_key'])->where('is_active', true)->firstOrFail();
        $result = app(OrganizationServiceKeyService::class)->create(
            $organization,
            $service,
            $validated['name'],
            $request->user(),
        );

        $this->log(
            'service_key_generated',
            "Generated {$service->key} service key for {$organization->name}",
            'auth',
            null,
            ['organization_id' => $organization->id],
        );

        return redirect()
            ->back()
            ->with('plain_service_key', $result['plain_key'])
            ->with('success', 'Service key generated. Copy it now — it will not be shown again.');
    }

    public function revokeServiceKey(Request $request, string $uuid): RedirectResponse
    {
        $this->requireCompanyAdmin($request);
        $organization = $this->resolveOrganization($request);

        $key = $organization->serviceKeys()->where('uuid', $uuid)->firstOrFail();
        app(OrganizationServiceKeyService::class)->revoke($organization, $key);

        $this->log('service_key_revoked', "Revoked service key {$key->name}", 'auth', null, [
            'organization_id' => $organization->id,
        ]);

        return redirect()->back()->with('success', 'Service key revoked.');
    }

    public function users(Request $request): Response
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);
        $search = $request->input('search', '');
        $status = $request->input('status', 'all');
        $role = $request->input('role', 'all');

        $base = User::query()
            ->where('organization_id', $organization->id)
            ->whereIn('role', ['admin', 'user']);

        $users = (clone $base)
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            }))
            ->when(in_array($status, ['pending', 'active', 'block']), fn ($q) => $q->where('status', $status))
            ->when(in_array($role, ['admin', 'user']), fn ($q) => $q->where('role', $role))
            ->withCount('tokens')
            ->latest()
            ->paginate(20)
            ->through(fn (User $u) => $this->userResource($u));

        return Inertia::render('company/users', [
            'organization' => $this->organizationPayload($organization),
            'users' => $users,
            'filters' => compact('search', 'status', 'role'),
            'summary' => [
                'total' => (clone $base)->count(),
                'active' => (clone $base)->where('status', 'active')->count(),
                'admins' => (clone $base)->where('role', 'admin')->count(),
                'users' => (clone $base)->where('role', 'user')->count(),
            ],
        ]);
    }

    public function storeUser(Request $request): RedirectResponse
    {
        $this->requireCompanyAdmin($request);

        $actor = $request->user();
        $organization = $this->resolveOrganization($request);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::in(['admin', 'user'])],
        ]);

        try {
            app(\App\Services\UserInviteService::class)->invite(
                $organization,
                $validated['email'],
                $validated['role'],
                $actor,
                $validated['name'] ?? null,
            );
        } catch (\Throwable $e) {
            report($e);

            return redirect()->back()->withErrors([
                'email' => $e->getMessage() ?: 'Failed to send invitation.',
            ]);
        }

        $this->log('invited', "Invited {$validated['email']} to {$organization->name}", 'auth', null, [
            'organization_id' => $organization->id,
        ]);

        return redirect()->back()->with('success', "Invitation sent to {$validated['email']}.");
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

        $this->log('updated', "Updated user {$user->email}", 'auth', $user, [
            'organization_id' => $organization->id,
        ]);

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
            'status' => ['required', Rule::in(['pending', 'active', 'block'])],
        ]);

        $user->update(['status' => $validated['status']]);

        $this->log('status_changed', "Set {$user->email} status to {$validated['status']}", 'auth', $user, [
            'organization_id' => $organization->id,
        ]);

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
            null,
            ['organization_id' => $organization->id],
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
            null,
            ['organization_id' => $organization->id],
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
            'role' => ['required', Rule::in(['admin', 'user'])],
        ]);

        $user->update(['role' => $validated['role']]);

        $this->log('role_changed', "Changed {$user->email} role to {$validated['role']}", 'auth', $user, [
            'organization_id' => $organization->id,
        ]);

        return redirect()->back()->with('success', "{$user->name} is now a {$validated['role']}.");
    }

    public function revokeUserTokens(Request $request, User $user): RedirectResponse
    {
        $this->requireCompanyAdmin($request);

        $organization = $this->resolveOrganization($request);
        $this->assertSameOrganization($organization, $user);

        $count = $user->tokens()->count();
        $user->tokens()->delete();

        $this->log('tokens_revoked', "Revoked {$count} token(s) for {$user->email}", 'auth', $user, [
            'organization_id' => $organization->id,
        ]);

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
        if ($user->isSuperAdmin()) {
            abort(403, 'Cannot manage a super admin from the company panel.');
        }

        if ((int) $user->organization_id !== (int) $organization->id) {
            abort(403, 'User does not belong to your organization.');
        }
    }
}
