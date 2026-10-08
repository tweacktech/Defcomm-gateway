<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\File;
use App\Models\MeetRoom;
use App\Models\OrganizationGroup;
use App\Models\OrganizationGroupUser;
use App\Models\PortalNotification;
use App\Models\User;
use App\Traits\LogsActivity;
use App\Traits\ResolvesOrganization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CompanyPortalController extends Controller
{
    use LogsActivity;
    use ResolvesOrganization;

    public function notifications(Request $request): Response
    {
        $org = $this->resolveOrganization($request);

        return Inertia::render('portal/company/notifications', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'items' => PortalNotification::query()
                ->where('organization_id', $org->id)
                ->latest()
                ->paginate(20),
        ]);
    }

    public function storeNotification(Request $request): RedirectResponse
    {
        $org = $this->resolveOrganization($request);
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'nullable|string',
            'audience' => ['required', Rule::in(['all', 'company', 'user'])],
        ]);

        $notification = PortalNotification::create([
            ...$data,
            'organization_id' => $org->id,
            'created_by' => $request->user()->id,
            'is_active' => true,
        ]);

        $this->log('created', "Created notification {$notification->title}", 'notifications', $notification, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Notification created.');
    }

    public function groups(Request $request): Response
    {
        $org = $this->resolveOrganization($request);

        $groups = OrganizationGroup::query()
            ->where('organization_id', $org->id)
            ->with([
                'members' => fn ($q) => $q->whereIn('status', ['joined', 'pending'])
                    ->with('user:id,name,email,role,status'),
            ])
            ->withCount(['members as member_count' => fn ($q) => $q->where('status', 'joined')])
            ->latest()
            ->get()
            ->map(fn (OrganizationGroup $group) => [
                'id' => $group->id,
                'name' => $group->name,
                'description' => $group->description,
                'member_count' => (int) $group->member_count,
                'created_at' => $group->created_at?->toIso8601String(),
                'members' => $group->members->map(fn (OrganizationGroupUser $m) => [
                    'id' => $m->id,
                    'user_id' => $m->user_id,
                    'status' => $m->status,
                    'join_date' => $m->join_date?->toIso8601String(),
                    'name' => $m->user?->name,
                    'email' => $m->user?->email,
                    'role' => $m->user?->role,
                ])->values(),
            ]);

        return Inertia::render('portal/company/groups', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'groups' => $groups,
            'users' => User::query()
                ->where('organization_id', $org->id)
                ->whereIn('role', ['admin', 'user'])
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'role']),
        ]);
    }

    public function storeGroup(Request $request): RedirectResponse
    {
        $org = $this->resolveOrganization($request);
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
        ]);

        $group = OrganizationGroup::create([
            ...$data,
            'organization_id' => $org->id,
        ]);

        $this->log('created', "Created group {$group->name}", 'groups', $group, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Group created.');
    }

    public function updateGroup(Request $request, OrganizationGroup $group): RedirectResponse
    {
        $org = $this->resolveOrganization($request);
        abort_unless((int) $group->organization_id === (int) $org->id, 403);

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
        ]);
        $group->update($data);

        $this->log('updated', "Updated group {$group->name}", 'groups', $group, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Group updated.');
    }

    public function destroyGroup(Request $request, OrganizationGroup $group): RedirectResponse
    {
        $org = $this->resolveOrganization($request);
        abort_unless((int) $group->organization_id === (int) $org->id, 403);

        $name = $group->name;
        OrganizationGroupUser::query()->where('group_id', $group->id)->delete();
        $group->delete();

        $this->log('deleted', "Deleted group {$name}", 'groups', null, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', 'Group deleted.');
    }

    public function addGroupMember(Request $request, OrganizationGroup $group): RedirectResponse
    {
        $org = $this->resolveOrganization($request);
        abort_unless((int) $group->organization_id === (int) $org->id, 403);

        $data = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
        ]);

        $member = User::query()->findOrFail($data['user_id']);
        abort_unless((int) $member->organization_id === (int) $org->id, 403);
        abort_unless(in_array($member->role, ['admin', 'user'], true), 403, 'Only organization users can be added to groups.');

        OrganizationGroupUser::updateOrCreate(
            ['group_id' => $group->id, 'user_id' => $member->id],
            [
                'organization_id' => $org->id,
                'status' => 'joined',
                'join_date' => now(),
            ],
        );

        $this->log('updated', "Added {$member->email} to group {$group->name}", 'groups', $group, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', "{$member->name} added to {$group->name}.");
    }

    public function removeGroupMember(Request $request, OrganizationGroup $group, User $user): RedirectResponse
    {
        $org = $this->resolveOrganization($request);
        abort_unless((int) $group->organization_id === (int) $org->id, 403);
        abort_unless((int) $user->organization_id === (int) $org->id, 403);

        $removed = OrganizationGroupUser::query()
            ->where('group_id', $group->id)
            ->where('user_id', $user->id)
            ->delete();

        abort_unless($removed > 0, 404, 'Member not found in this group.');

        $this->log('updated', "Removed {$user->email} from group {$group->name}", 'groups', $group, [
            'organization_id' => $org->id,
        ]);

        return back()->with('success', "{$user->name} removed from {$group->name}.");
    }

    public function files(Request $request): Response
    {
        $org = $this->resolveOrganization($request);
        $userIds = $this->organizationUserIds($org);

        return Inertia::render('portal/company/files', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'items' => File::query()
                ->whereIn('user_id', $userIds ?: [0])
                ->with('owner:id,name,email,organization_id')
                ->latest()
                ->paginate(20),
        ]);
    }

    public function meetings(Request $request): Response
    {
        $org = $this->resolveOrganization($request);
        $userIds = $this->organizationUserIds($org);

        return Inertia::render('portal/company/meetings', [
            'organization' => ['id' => $org->id, 'name' => $org->name],
            'items' => MeetRoom::query()
                ->whereIn('owner_id', $userIds ?: [0])
                ->latest()
                ->paginate(20),
        ]);
    }

    public function profile(Request $request): Response
    {
        $user = $request->user();
        $org = $user->organization_id
            ? $this->resolveOrganization($request)
            : null;

        return Inertia::render('portal/company/profile', [
            'user' => $user->only(['id', 'name', 'email', 'phone', 'role', 'status', 'organization_id']),
            'organization' => $org ? ['id' => $org->id, 'name' => $org->name] : null,
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => 'nullable|string|max:40',
            'password' => 'nullable|string|min:8|confirmed',
        ]);

        $payload = [
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
        ];
        if (! empty($data['password'])) {
            $payload['password'] = Hash::make($data['password']);
        }
        $user->update($payload);

        if ($user->organization_id) {
            $this->log('updated', 'Updated company profile', 'profile', $user, [
                'organization_id' => $user->organization_id,
            ]);
        }

        return back()->with('success', 'Profile updated.');
    }
}
