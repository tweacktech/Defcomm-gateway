<?php

namespace App\Modules\SecureDB\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSecureDbAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user?->isSuperAdmin() || ! $user->canAccessPlatform('secure_db')) {
            abort(403, 'Admin access required for Secure DB.');
        }

        return $next($request);
    }
}
