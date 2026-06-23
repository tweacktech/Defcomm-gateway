<?php

namespace App\Modules\SecureDB\Models;

use App\Modules\SecureDB\Concerns\HasUuid;
use App\Modules\SecureDB\Enums\SecureDbPermission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class SecureDbRole extends Model
{
    use HasUuid;

    protected $table = 'secure_db_roles';

    protected $fillable = ['name', 'slug', 'permissions', 'description'];

    protected function casts(): array
    {
        return ['permissions' => 'array'];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            \App\Models\User::class,
            'secure_db_project_user',
            'role_id',
            'user_id'
        )->withPivot('project_id')->withTimestamps();
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissions ?? [], true);
    }

    public static function defaultRoles(): array
    {
        $all = SecureDbPermission::all();

        return [
            ['name' => 'Super Admin', 'slug' => 'super_admin', 'permissions' => $all],
            ['name' => 'Organization Admin', 'slug' => 'organization_admin', 'permissions' => array_diff($all, ['rotate'])],
            ['name' => 'Security Officer', 'slug' => 'security_officer', 'permissions' => ['view', 'encrypt', 'decrypt', 'rotate', 'approve_devices']],
            ['name' => 'Developer', 'slug' => 'developer', 'permissions' => ['view', 'create', 'edit', 'encrypt', 'decrypt']],
            ['name' => 'Viewer', 'slug' => 'viewer', 'permissions' => ['view']],
        ];
    }
}
