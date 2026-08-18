<?php

namespace App\Modules\SecureDB\Middleware;

use App\Modules\SecureDB\Models\SecureDbWidget;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class SecureDbWidgetSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-Widget-Token') ?? $request->input('widget_token');

        if (! $token) {
            return $this->jsonError('Widget session token required.', 401);
        }

        $widgetId = Cache::get("secure_db_widget_session:{$token}");
        if (! $widgetId) {
            return $this->jsonError('Invalid or expired widget session.', 401);
        }

        $widget = SecureDbWidget::with(['project'])
            ->where('id', $widgetId)
            ->where('is_active', true)
            ->first();

        if (! $widget) {
            Cache::forget("secure_db_widget_session:{$token}");

            return $this->jsonError('Widget is inactive or not found.', 401);
        }

        $request->attributes->set('secure_db_widget', $widget);
        $request->attributes->set('secure_db_widget_token', $token);

        return $next($request);
    }

    protected function jsonError(string $message, int $status): Response
    {
        return response()->json(['message' => $message], $status)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Headers', 'Content-Type, X-Widget-Token');
    }
}
