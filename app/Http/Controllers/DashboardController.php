<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Organization;
use App\Models\Service;
use App\Models\User;
use App\Traits\LogsActivity;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    use LogsActivity;

    public function dashboard(): Response
    {
        $user = Auth::user();

        $services = Service::query()
            ->orderBy('name')
            ->get(['id', 'key', 'name', 'description', 'is_active', 'created_at']);

        if ($user->isSuperAdmin()) {
            return Inertia::render('admin/admin-dashboard', [
                'services' => $services->map(fn ($s) => [
                    'id' => $s->id,
                    'key' => $s->key,
                    'name' => $s->name,
                    'description' => $s->description,
                    'is_active' => $s->is_active,
                    'web_path' => $s->web_path,
                    'api_base_path' => $s->api_base_path,
                    'endpoint_count' => count($s->api_endpoints ?? []),
                    'created_at' => $s->created_at->toIso8601String(),
                ]),
                'stats' => $this->adminStats(),
                'user_summary' => $this->userSummary(),
                'organization_summary' => $this->organizationSummary(),
                'activity_logs' => $this->allActivity(),
            ]);
        }

        if ($user->isCompanyAdmin() && $user->organization_id) {
            $organization = Organization::query()->findOrFail($user->organization_id);

            return Inertia::render('dashboard', [
                'services' => $services,
                'organization' => [
                    'id' => $organization->id,
                    'name' => $organization->name,
                ],
                'org_summary' => $this->companyOrgSummary($organization->id),
                'activity_logs' => $this->organizationActivity($organization->id),
            ]);
        }

        return Inertia::render('dashboard', [
            'services' => $services,
            'organization' => null,
            'org_summary' => null,
            'activity_logs' => $this->userActivity($user->id),
        ]);
    }

    private function adminStats(): array
    {
        return [
            'total_services' => Service::count(),
            'active_services' => Service::where('is_active', true)->count(),
            'total_users' => User::count(),
            'total_organizations' => Organization::count(),
        ];
    }

    private function organizationSummary(): array
    {
        return [
            'total' => Organization::count(),
            'active' => Organization::where('status', 'active')->count(),
            'with_credentials' => Organization::where('client_credentials_active', true)->count(),
        ];
    }

    private function companyOrgSummary(int $organizationId): array
    {
        $base = User::query()->where('organization_id', $organizationId);

        return [
            'total_users' => (clone $base)->count(),
            'active_users' => (clone $base)->where('status', 'active')->count(),
            'pending_users' => (clone $base)->where('status', 'pending')->count(),
            'admins' => (clone $base)->where('role', 'admin')->count(),
            'users' => (clone $base)->where('role', 'user')->count(),
        ];
    }

    private function userSummary(): array
    {
        return [
            'total' => User::count(),
            'active' => User::where('status', 'active')->count(),
            'pending' => User::where('status', 'pending')->count(),
            'block' => User::where('status', 'block')->count(),
            'admins' => User::where('role', 'admin')->count(),
            'supers' => User::where('role', 'super')->count(),
            'users' => User::where('role', 'user')->count(),
            'new_this_week' => User::where('created_at', '>=', now()->subWeek())->count(),
        ];
    }

    private function mapActivity(ActivityLog $log, bool $withCauser = false): array
    {
        $row = [
            'id' => $log->id,
            'event' => $log->event,
            'description' => $log->description,
            'module' => $log->module,
            'organization_id' => $log->organization_id,
            'icon' => $log->iconName(),
            'color' => $log->colorClass(),
            'created_at' => $log->created_at->toIso8601String(),
            'time_ago' => $log->created_at->diffForHumans(),
        ];

        if ($withCauser) {
            $row['causer'] = $log->causer ? [
                'id' => $log->causer->id,
                'name' => $log->causer->name,
                'email' => $log->causer->email,
            ] : null;
        }

        return $row;
    }

    private function userActivity(int $userId): array
    {
        return ActivityLog::forUser($userId)
            ->latest('created_at')
            ->limit(20)
            ->get(['id', 'event', 'description', 'module', 'organization_id', 'created_at'])
            ->map(fn ($log) => $this->mapActivity($log))
            ->toArray();
    }

    private function organizationActivity(int $organizationId): array
    {
        return ActivityLog::forOrganization($organizationId)
            ->with('causer:id,name,email')
            ->latest('created_at')
            ->limit(30)
            ->get(['id', 'causer_id', 'causer_type', 'event', 'description', 'module', 'organization_id', 'created_at'])
            ->map(fn ($log) => $this->mapActivity($log, true))
            ->toArray();
    }

    private function allActivity(): array
    {
        return ActivityLog::with('causer:id,name,email')
            ->latest('created_at')
            ->limit(50)
            ->get(['id', 'causer_id', 'causer_type', 'event', 'description', 'module', 'organization_id', 'created_at'])
            ->map(fn ($log) => $this->mapActivity($log, true))
            ->toArray();
    }
}
