<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use App\Services\UserInviteService;
use App\Traits\LogsActivity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationController extends Controller
{
    use LogsActivity;

    public function index(Request $request): Response
    {
        abort_unless($request->user()?->canAccessPlatform('organizations'), 403);

        $search = $request->input('search', '');
        $status = $request->input('status', 'all');

        $organizations = Organization::query()
            ->withCount('users')
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            }))
            ->when(in_array($status, ['active', 'inactive', 'suspended']), fn ($q) => $q->where('status', $status))
            ->latest()
            ->paginate(15)
            ->through(fn (Organization $org) => $this->organizationResource($org));

        return Inertia::render('admin/admin-organizations-index', [
            'organizations' => $organizations,
            'filters' => compact('search', 'status'),
            'summary' => [
                'total' => Organization::count(),
                'active' => Organization::where('status', 'active')->count(),
                'inactive' => Organization::where('status', 'inactive')->count(),
                'suspended' => Organization::where('status', 'suspended')->count(),
                'with_credentials' => Organization::where('client_credentials_active', true)->count(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->canAccessPlatform('organizations'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:organizations,email'],
            'status' => ['required', Rule::in(['active', 'inactive', 'suspended'])],
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'email', 'max:255'],
        ]);

        $organization = Organization::create([
            'name' => $validated['name'],
            'email' => $validated['email'] ?? null,
            'status' => $validated['status'],
        ]);

        app(UserInviteService::class)->invite(
            $organization,
            $validated['admin_email'],
            'admin',
            $request->user(),
            $validated['admin_name'],
        );

        $this->log('created', "Created organization \"{$organization->name}\"", 'organization', $organization);

        return redirect()->back()->with(
            'success',
            "Organization \"{$organization->name}\" created. Invitation sent to {$validated['admin_email']}."
        );
    }

    public function update(Request $request, Organization $organization): RedirectResponse
    {
        abort_unless($request->user()?->canAccessPlatform('organizations'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('organizations', 'email')->ignore($organization->id)],
            'status' => ['required', Rule::in(['active', 'inactive', 'suspended'])],
        ]);

        $organization->update($validated);

        $this->log('updated', "Updated organization \"{$organization->name}\"", 'organization', $organization);

        return redirect()->back()->with('success', "Organization \"{$organization->name}\" updated.");
    }

    public function destroy(Request $request, Organization $organization): RedirectResponse
    {
        abort_unless($request->user()?->canAccessPlatform('organizations'), 403);

        if ($organization->users()->exists()) {
            return redirect()->back()->withErrors([
                'delete' => 'Cannot delete an organization that still has users. Reassign or remove users first.',
            ]);
        }

        $name = $organization->name;
        $organization->delete();

        $this->log('deleted', "Deleted organization \"{$name}\"", 'organization');

        return redirect()->back()->with('success', "Organization \"{$name}\" deleted.");
    }

    public function show(Request $request, Organization $organization): Response
    {
        abort_unless($request->user()?->canAccessPlatform('organizations'), 403);

        $organization->loadCount('users');

        $users = User::query()
            ->where('organization_id', $organization->id)
            ->latest()
            ->paginate(20)
            ->through(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'role_label' => $u->roleLabel(),
                'status' => $u->status,
                'created_at' => $u->created_at->toIso8601String(),
            ]);

        return Inertia::render('admin/admin-organization-show', [
            'organization' => $this->organizationResource($organization),
            'users' => $users,
        ]);
    }

    public function inviteAdmin(Request $request, Organization $organization): RedirectResponse
    {
        abort_unless($request->user()?->canAccessPlatform('organizations'), 403);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
        ]);

        app(UserInviteService::class)->invite(
            $organization,
            $validated['email'],
            'admin',
            $request->user(),
            $validated['name'] ?? null,
        );

        return redirect()->back()->with('success', "Invitation sent to {$validated['email']}.");
    }

    private function organizationResource(Organization $organization): array
    {
        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'email' => $organization->email,
            'status' => $organization->status,
            'users_count' => $organization->users_count ?? $organization->users()->count(),
            'client_id' => $organization->client_id,
            'client_credentials_active' => (bool) $organization->client_credentials_active,
            'created_at' => $organization->created_at?->toIso8601String(),
        ];
    }
}
