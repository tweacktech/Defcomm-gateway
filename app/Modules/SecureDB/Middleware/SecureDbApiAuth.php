<?php

namespace App\Modules\SecureDB\Middleware;

use App\Modules\SecureDB\Models\SecureDbProject;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class SecureDbApiAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $apiKey = $request->header('X-Secure-DB-Key') ?? $request->input('api_key');
        $secret = $request->header('X-Secure-DB-Secret') ?? $request->input('secret_key');

        if (! $apiKey || ! $secret) {
            return response()->json(['message' => 'API credentials required.'], 401);
        }

        $project = SecureDbProject::where('api_key', $apiKey)->first();
        if (! $project || $project->status !== 'active') {
            return response()->json(['message' => 'Invalid API key or inactive project.'], 401);
        }

        if (! Hash::check($secret, $project->secret_key_hash)) {
            return response()->json(['message' => 'Invalid secret key.'], 401);
        }

        $allowedIps = $project->allowed_ips ?? [];
        if (! empty($allowedIps) && ! in_array($request->ip(), $allowedIps, true)) {
            return response()->json(['message' => 'IP address not allowed.'], 403);
        }

        $rateKey = "secure_db_rate:{$project->id}:{$request->ip()}";
        $count = Cache::increment($rateKey);
        if ($count === 1) {
            Cache::put($rateKey, 1, 60);
        }
        if ($count > $project->rate_limit_per_minute) {
            return response()->json(['message' => 'Rate limit exceeded.'], 429);
        }

        $request->attributes->set('secure_db_project', $project);

        return $next($request);
    }
}
