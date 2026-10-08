<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactList;
use App\Models\OrganizationGroup;
use App\Models\OrganizationGroupUser;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactsApiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = ContactList::query()
            ->with('contact:id,name,email,phone')
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->get()
            ->map(fn (ContactList $c) => [
                'id' => $c->id,
                'contact_id' => $c->user_link,
                'contact_name' => $c->contact?->name,
                'contact_email' => $c->contact?->email,
                'contact_phone' => $c->contact?->phone ?? null,
                'contact_status' => $c->status,
            ]);

        return $this->ok($rows);
    }

    public function add(Request $request, int $userId): JsonResponse
    {
        abort_if($userId === (int) $request->user()->id, 422, 'Cannot add yourself.');
        $target = User::query()->findOrFail($userId);

        abort_unless(
            $request->user()->isSuperAdmin()
            || (
                $request->user()->organization_id
                && (int) $target->organization_id === (int) $request->user()->organization_id
            ),
            403,
            'Contacts must belong to your organization.'
        );

        ContactList::firstOrCreate(
            ['user_id' => $request->user()->id, 'user_link' => $userId],
            ['status' => 'active'],
        );

        return $this->ok(null, 'Contact added.', 201);
    }

    public function remove(Request $request, int $id): JsonResponse
    {
        ContactList::query()
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail()
            ->delete();

        return $this->ok(null, 'Contact removed.');
    }

    public function groups(Request $request): JsonResponse
    {
        $rows = OrganizationGroupUser::query()
            ->with('group')
            ->where('user_id', $request->user()->id)
            ->where('status', 'joined')
            ->get()
            ->map(fn (OrganizationGroupUser $m) => [
                'id' => $m->id,
                'group_id' => $m->group_id,
                'group_name' => $m->group?->name,
                'join_date' => $m->join_date?->toIso8601String(),
                'hide_my_detail' => $m->hide,
                'status' => $m->status,
            ]);

        return $this->ok($rows);
    }

    public function pendingGroups(Request $request): JsonResponse
    {
        $rows = OrganizationGroupUser::query()
            ->with('group')
            ->where('user_id', $request->user()->id)
            ->where('status', 'pending')
            ->get()
            ->map(fn (OrganizationGroupUser $m) => [
                'id' => $m->id,
                'group_name' => $m->group?->name,
                'invitation_date' => $m->created_at?->toIso8601String(),
                'status' => $m->status,
            ]);

        return $this->ok($rows);
    }

    public function acceptGroup(Request $request, int $id): JsonResponse
    {
        $membership = OrganizationGroupUser::query()
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $membership->update(['status' => 'joined', 'join_date' => now()]);

        return $this->ok(null, 'Group invitation accepted.');
    }

    public function declineGroup(Request $request, int $id): JsonResponse
    {
        OrganizationGroupUser::query()
            ->where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail()
            ->delete();

        return $this->ok(null, 'Group invitation declined.');
    }

    public function groupMembers(Request $request, int $id): JsonResponse
    {
        $group = OrganizationGroup::query()->findOrFail($id);
        $user = $request->user();

        $isMember = OrganizationGroupUser::query()
            ->where('group_id', $id)
            ->where('user_id', $user->id)
            ->where('status', 'joined')
            ->exists();

        $isOrgAdmin = $user->isCompanyAdmin()
            && $user->organization_id
            && (int) $group->organization_id === (int) $user->organization_id;

        abort_unless($isMember || $isOrgAdmin || $user->isSuperAdmin(), 403);

        $members = OrganizationGroupUser::query()
            ->with('user:id,name,organization_id')
            ->where('group_id', $id)
            ->where('status', 'joined')
            ->whereHas('user', function ($q) use ($group) {
                $q->where('organization_id', $group->organization_id);
            })
            ->get()
            ->map(fn (OrganizationGroupUser $m) => [
                'id' => $m->id,
                'join_date' => $m->join_date?->toIso8601String(),
                'hide_member_detail' => $m->hide,
                'member_id' => $m->user_id,
                'member_name' => $m->user?->name,
            ]);

        return response()->json([
            'status' => '200',
            'message' => 'OK',
            'group_meta' => [
                'id' => $group->id,
                'organization_id' => $group->organization_id,
                'name' => $group->name,
                'description' => $group->description,
                'avatar' => $group->avatar,
                'created_at' => $group->created_at?->toIso8601String(),
                'updated_at' => $group->updated_at?->toIso8601String(),
            ],
            'data' => $members,
        ]);
    }

    protected function ok(mixed $data, string $message = 'OK', int $status = 200): JsonResponse
    {
        return response()->json([
            'status' => (string) $status,
            'message' => $message,
            'data' => $data,
        ], $status === 201 ? 201 : 200);
    }
}
