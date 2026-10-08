<?php

namespace App\Traits;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\Request;

trait ResolvesOrganization
{
    protected function resolveOrganization(Request $request): Organization
    {
        $user = $request->user();
        abort_unless($user && ($user->isSuperAdmin() || $user->isCompanyAdmin()), 403);

        if ($user->isSuperAdmin() && $request->filled('organization_id')) {
            return Organization::query()->findOrFail($request->integer('organization_id'));
        }

        abort_unless($user->organization_id, 422, 'You are not assigned to an organization.');

        return Organization::query()->findOrFail($user->organization_id);
    }

    protected function assertSameOrganization(Organization $organization, User $user): void
    {
        if ($user->isSuperAdmin()) {
            abort(403, 'Cannot manage a super admin from the company panel.');
        }

        abort_unless(
            (int) $user->organization_id === (int) $organization->id,
            403,
            'User does not belong to this organization.'
        );
    }

    /** @return list<int> */
    protected function organizationUserIds(Organization $organization): array
    {
        return User::query()
            ->where('organization_id', $organization->id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
