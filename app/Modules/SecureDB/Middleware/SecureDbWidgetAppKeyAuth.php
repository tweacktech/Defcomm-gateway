<?php

namespace App\Modules\SecureDB\Middleware;

use App\Modules\SecureDB\Services\WidgetAppKeyService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecureDbWidgetAppKeyAuth
{
    public function __construct(
        protected WidgetAppKeyService $keys,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $plain = $request->header('X-Secure-DB-App-Key')
            ?? $request->bearerToken()
            ?? $request->input('app_key');

        if (! $plain) {
            return $this->deny('App API key required. Send X-Secure-DB-App-Key.', 401);
        }

        $record = $this->keys->findByPlainKey($plain);
        if (! $record || ! $record->isUsable()) {
            return $this->deny('Invalid or revoked app API key.', 401);
        }

        $widget = $record->widget()->with('project')->first();
        if (! $widget || ! $widget->is_active || $widget->project?->status !== 'active') {
            return $this->deny('Widget or project is inactive.', 403);
        }

        $request->attributes->set('secure_db_app_key', $record);
        $request->attributes->set('secure_db_widget', $widget);
        $request->attributes->set('secure_db_project', $widget->project);

        return $next($request);
    }

    protected function deny(string $message, int $status): Response
    {
        return response()->json(['message' => $message], $status)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Secure-DB-App-Key');
    }
}
