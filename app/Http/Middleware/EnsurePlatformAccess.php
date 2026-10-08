<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformAccess
{
    public function handle(Request $request, Closure $next, string $area): Response
    {
        $user = $request->user();

        if (! $user?->isSuperAdmin()) {
            abort(403, 'Super admin access required.');
        }

        if (! $user->canAccessPlatform($area)) {
            abort(403, 'Your platform role cannot access this area.');
        }

        return $next($request);
    }
}
