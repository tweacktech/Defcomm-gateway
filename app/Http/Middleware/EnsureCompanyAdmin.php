<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCompanyAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || (! $user->isSuperAdmin() && ! $user->isCompanyAdmin())) {
            abort(403, 'Company admin access required.');
        }

        // Company admins must be tied to an organization.
        if ($user->isCompanyAdmin() && ! $user->isSuperAdmin() && ! $user->organization_id) {
            abort(422, 'You are not assigned to an organization.');
        }

        return $next($request);
    }
}
