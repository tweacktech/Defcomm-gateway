<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user() ? [
                    ...$request->user()->toArray(),
                    'role_label' => $request->user()->roleLabel(),
                    'is_super_admin' => $request->user()->isSuperAdmin(),
                    'is_company_admin' => $request->user()->isCompanyAdmin(),
                ] : null,
            ],
            'flash' => [
                'success' => session('success'),
                'error' => session('error'),
                'info' => session('info'),
                'warning' => session('warning'),
                'share_url' => session('share_url'),  // for Drive share links
                'connection_test' => session('connection_test'),
                'widget_created' => session('widget_created'),
                'widget_secret' => session('widget_secret'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
