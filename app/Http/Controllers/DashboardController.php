<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
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
            ->get(['id', 'name', 'description', 'is_active', 'created_at']);

        if ($user->is_admin) {
            return Inertia::render('admin/admin-dashboard', [
                'services'       => $services,
                'stats'          => $this->adminStats(),
                'activity_logs'  => $this->allActivity(),
            ]);
        }

        return Inertia::render('dashboard', [
            'services'      => $services,
            'activity_logs' => $this->userActivity($user->id),
        ]);
    }

    // ── Activity helpers ──────────────────────────────────────────────────────

    /**
     * Last 20 actions performed by the authenticated user.
     * Shown on the client dashboard.
     */
    private function userActivity(int $userId): array
    {
        return ActivityLog::forUser($userId)
            ->latest('created_at')
            ->limit(20)
            ->get(['id', 'event', 'description', 'module', 'created_at'])
            ->map(fn ($log) => [
                'id'          => $log->id,
                'event'       => $log->event,
                'description' => $log->description,
                'module'      => $log->module,
                'icon'        => $log->iconName(),
                'color'       => $log->colorClass(),
                'created_at'  => $log->created_at->toIso8601String(),
                'time_ago'    => $log->created_at->diffForHumans(),
            ])
            ->toArray();
    }

    /**
     * Last 50 actions platform-wide, with causer info.
     * Shown on the admin dashboard.
     */
    private function allActivity(): array
    {
        return ActivityLog::with('causer:id,name,email')
            ->latest('created_at')
            ->limit(50)
            ->get(['id', 'causer_id', 'causer_type', 'event', 'description', 'module', 'created_at'])
            ->map(fn ($log) => [
                'id'          => $log->id,
                'event'       => $log->event,
                'description' => $log->description,
                'module'      => $log->module,
                'icon'        => $log->iconName(),
                'color'       => $log->colorClass(),
                'created_at'  => $log->created_at->toIso8601String(),
                'time_ago'    => $log->created_at->diffForHumans(),
                'causer'      => $log->causer ? [
                    'id'    => $log->causer->id,
                    'name'  => $log->causer->name,
                    'email' => $log->causer->email,
                ] : null,
            ])
            ->toArray();
    }

    // ── Admin stats ───────────────────────────────────────────────────────────

    private function adminStats(): array
    {
        return [
            'total_services'  => Service::count(),
            'active_services' => Service::where('is_active', true)->count(),
            'total_users'     => User::count(),
            // 'total_orders'  => Order::count(),
        ];
    }
}
