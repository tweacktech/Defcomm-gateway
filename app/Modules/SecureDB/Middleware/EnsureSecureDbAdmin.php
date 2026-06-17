<?php

namespace App\Modules\SecureDB\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSecureDbAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->role !== 'admin') {
            abort(403, 'Admin access required for Secure DB.');
        }

        return $next($request);
    }
}
