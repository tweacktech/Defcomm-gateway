<?php

namespace App\Modules\SecureDB\Services;

use App\Models\User;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Models\SecureDbRole;
use Illuminate\Support\Facades\DB;

class PermissionService
{
    public function authorize(?User $user, SecureDbProject $project, string $permission): void
    {
        if (! $user) {
            abort(403, 'Authentication required.');
        }

        if ($user->role === 'admin') {
            return;
        }

        if ($project->owner_id === $user->id) {
            return;
        }

        $roleId = DB::table('secure_db_project_user')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->value('role_id');

        if (! $roleId) {
            abort(403, 'No access to this project.');
        }

        $role = SecureDbRole::find($roleId);
        if (! $role || ! $role->hasPermission($permission)) {
            abort(403, "Missing permission: {$permission}");
        }
    }

    public function userPermissions(?User $user, ?SecureDbProject $project = null): array
    {
        if (! $user) {
            return [];
        }

        if ($user->role === 'admin') {
            return \App\Modules\SecureDB\Enums\SecureDbPermission::all();
        }

        if ($project && $project->owner_id === $user->id) {
            return \App\Modules\SecureDB\Enums\SecureDbPermission::all();
        }

        if (! $project) {
            return ['view'];
        }

        $roleId = DB::table('secure_db_project_user')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->value('role_id');

        return $roleId ? (SecureDbRole::find($roleId)?->permissions ?? []) : [];
    }
}
