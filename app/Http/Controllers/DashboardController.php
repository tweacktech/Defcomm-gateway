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

        return Inertia::render('dashboard', [
            'services' => $services,
            'activity_logs' => $this->userActivity($user->id),
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

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

    private function userSummary(): array
    {
        return [
            'total' => User::count(),
            'active' => User::where('status', 'active')->count(),
            'inactive' => User::where('status', 'inactive')->count(),
            'admins' => User::whereIn('role', ['admin', 'company_admin'])->count(),
            'super_admins' => User::where('role', 'admin')->count(),
            'company_admins' => User::where('role', 'company_admin')->count(),
            'new_this_week' => User::where('created_at', '>=', now()->subWeek())->count(),
        ];
    }

    private function userActivity(int $userId): array
    {
        return ActivityLog::forUser($userId)
            ->latest('created_at')
            ->limit(20)
            ->get(['id', 'event', 'description', 'module', 'created_at'])
            ->map(fn ($log) => [
                'id' => $log->id,
                'event' => $log->event,
                'description' => $log->description,
                'module' => $log->module,
                'icon' => $log->iconName(),
                'color' => $log->colorClass(),
                'created_at' => $log->created_at->toIso8601String(),
                'time_ago' => $log->created_at->diffForHumans(),
            ])
            ->toArray();
    }

    private function allActivity(): array
    {
        return ActivityLog::with('causer:id,name,email')
            ->latest('created_at')
            ->limit(50)
            ->get(['id', 'causer_id', 'causer_type', 'event', 'description', 'module', 'created_at'])
            ->map(fn ($log) => [
                'id' => $log->id,
                'event' => $log->event,
                'description' => $log->description,
                'module' => $log->module,
                'icon' => $log->iconName(),
                'color' => $log->colorClass(),
                'created_at' => $log->created_at->toIso8601String(),
                'time_ago' => $log->created_at->diffForHumans(),
                'causer' => $log->causer ? [
                    'id' => $log->causer->id,
                    'name' => $log->causer->name,
                    'email' => $log->causer->email,
                ] : null,
            ])
            ->toArray();
    }
}
