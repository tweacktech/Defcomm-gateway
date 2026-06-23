<?php

namespace App\Modules\SecureDB\Policies;

use App\Models\User;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Services\PermissionService;

class SecureDbProjectPolicy
{
    public function __construct(protected PermissionService $permissions) {}

    public function viewAny(User $user): bool
    {
        return $user->role === 'admin';
    }

    public function view(User $user, SecureDbProject $project): bool
    {
        return $this->hasPermission($user, $project, 'view');
    }

    public function create(User $user): bool
    {
        return $user->role === 'admin';
    }

    public function update(User $user, SecureDbProject $project): bool
    {
        return $this->hasPermission($user, $project, 'edit');
    }

    public function delete(User $user, SecureDbProject $project): bool
    {
        return $this->hasPermission($user, $project, 'delete');
    }

    public function encrypt(User $user, SecureDbProject $project): bool
    {
        return $this->hasPermission($user, $project, 'encrypt');
    }

    public function decrypt(User $user, SecureDbProject $project): bool
    {
        return $this->hasPermission($user, $project, 'decrypt');
    }

    public function rotate(User $user, SecureDbProject $project): bool
    {
        return $this->hasPermission($user, $project, 'rotate');
    }

    protected function hasPermission(User $user, SecureDbProject $project, string $permission): bool
    {
        try {
            $this->permissions->authorize($user, $project, $permission);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }
}
