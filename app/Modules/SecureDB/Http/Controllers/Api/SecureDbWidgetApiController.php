<?php

namespace App\Modules\SecureDB\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\SecureDB\Jobs\EncryptConnectionDataJob;
use App\Modules\SecureDB\Models\SecureDbAuditLog;
use App\Modules\SecureDB\Models\SecureDbWidget;
use App\Modules\SecureDB\Services\AuditService;
use App\Modules\SecureDB\Services\DatabaseEncryptionService;
use App\Modules\SecureDB\Services\EncryptionService;
use App\Modules\SecureDB\Services\KeyManagementService;
use App\Modules\SecureDB\Services\WidgetClientConnectionService;
use App\Modules\SecureDB\Services\WidgetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class SecureDbWidgetApiController extends Controller
{
    public function __construct(
        protected WidgetService $widgets,
        protected WidgetClientConnectionService $clientConnections,
        protected EncryptionService $encryption,
        protected KeyManagementService $kms,
        protected AuditService $audit,
    ) {}

    public function authenticate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'widget_key' => 'required|string|max:64',
            'secret_key' => 'required|string',
        ]);

        $widget = SecureDbWidget::with(['project'])
            ->where('widget_key', $data['widget_key'])
            ->where('is_active', true)
            ->first();

        if (! $widget || ! $this->widgets->verifySecret($widget, $data['secret_key'])) {
            return $this->corsJson(['message' => 'Invalid widget key or secret.'], 401);
        }

        if (! $this->originAllowed($request, $widget)) {
            return $this->corsJson(['message' => 'Origin not allowed for this widget.'], 403);
        }

        $token = Str::random(64);
        Cache::put("secure_db_widget_session:{$token}", $widget->id, now()->addHours(8));

        $this->widgets->recordAccess($widget);
        $this->audit->log(
            $widget->project,
            'login',
            "Widget authenticated: {$widget->name}",
            null,
            $request,
            true,
            ['widget_id' => $widget->uuid, 'source' => 'embed'],
        );

        return $this->corsJson([
            'token' => $token,
            'expires_at' => now()->addHours(8)->toIso8601String(),
            'widget' => $this->widgetPayload($widget),
            'algorithms' => DatabaseEncryptionService::supportedAlgorithms(),
            'database_market' => WidgetService::databaseTypes(),
            'default_port' => WidgetService::DATABASE_MARKET[$widget->database_type]['port'] ?? 3306,
            'connection' => $this->clientConnections->status($token),
            'requires_client_connection' => true,
        ]);
    }

    public function connectionStatus(Request $request): JsonResponse
    {
        $widget = $this->widget($request);
        $token = $request->attributes->get('secure_db_widget_token');

        return $this->corsJson([
            'connected' => $this->clientConnections->status($token) !== null,
            'connection' => $this->clientConnections->status($token),
            'database_type' => $widget->database_type,
            'default_port' => WidgetService::DATABASE_MARKET[$widget->database_type]['port'] ?? 3306,
        ]);
    }

    public function connectDatabase(Request $request): JsonResponse
    {
        $widget = $this->widget($request);
        $token = $request->attributes->get('secure_db_widget_token');

        $data = $request->validate([
            'host' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'database_name' => 'required_unless:database_type,redis|string|max:255|nullable',
            'username' => 'nullable|string|max:255',
            'password' => 'nullable|string',
            'ssl_enabled' => 'boolean',
            'connection_timeout' => 'nullable|integer|min:1|max:120',
            'redis_database' => 'nullable|integer|min:0|max:15',
        ]);

        try {
            $result = $this->clientConnections->connect($token, $widget, [
                ...$data,
                'database_type' => $widget->database_type,
            ]);

            $this->audit->log($widget->project, 'database_access', "Widget connected to client DB: {$data['host']}", null, $request, true, [
                'widget_id' => $widget->uuid,
                'database_type' => $widget->database_type,
            ]);

            return $this->corsJson([
                'success' => true,
                'message' => 'Connected to your database successfully.',
                'connection' => $result,
            ]);
        } catch (\Throwable $e) {
            $this->audit->log($widget->project, 'database_access', 'Widget DB connection failed', null, $request, false, [
                'widget_id' => $widget->uuid,
                'error' => $e->getMessage(),
            ]);

            return $this->corsJson(['message' => $e->getMessage()], 422);
        }
    }

    public function disconnectDatabase(Request $request): JsonResponse
    {
        $token = $request->attributes->get('secure_db_widget_token');
        $this->clientConnections->disconnect($token);

        return $this->corsJson(['message' => 'Database disconnected.']);
    }

    public function config(Request $request): JsonResponse
    {
        $widget = $this->widget($request);
        $token = $request->attributes->get('secure_db_widget_token');
        $clientConn = $this->clientConnections->status($token);

        return $this->corsJson([
            'widget' => $this->widgetPayload($widget),
            'algorithms' => DatabaseEncryptionService::supportedAlgorithms(),
            'database_market' => WidgetService::databaseTypes(),
            'default_port' => WidgetService::DATABASE_MARKET[$widget->database_type]['port'] ?? 3306,
            'connection' => $clientConn,
            'connected' => $clientConn !== null,
            'project' => [
                'uuid' => $widget->project->uuid,
                'name' => $widget->project->name,
            ],
        ]);
    }

    public function encryptValue(Request $request): JsonResponse
    {
        $widget = $this->widget($request);
        $data = $request->validate([
            'value' => 'required|string|max:65535',
            'algorithm' => 'nullable|in:aes-256-gcm,chacha20-poly1305,rsa-4096-hybrid',
        ]);

        $project = $widget->project;
        $key = $project->activeKey() ?? $this->kms->generateProjectKey($project);
        $dek = $this->kms->getDecryptedKey($key);
        $algo = $data['algorithm'] ?? $key->algorithm;
        $encrypted = $this->encryption->encryptField($data['value'], $dek, $algo);

        $project->increment('encrypted_records_count');
        $this->audit->log($project, 'encryption', 'Widget field encryption', null, $request, true, [
            'widget_id' => $widget->uuid,
            'algorithm' => $algo,
        ]);

        return $this->corsJson([
            'encrypted' => $encrypted,
            'algorithm' => $algo,
            'key_version' => $key->key_version,
        ]);
    }

    public function queueDatabaseEncryption(Request $request): JsonResponse
    {
        $widget = $this->widget($request);
        $data = $request->validate([
            'scope' => 'required|in:database,table,field',
            'algorithm' => 'required|in:aes-256-gcm,chacha20-poly1305,rsa-4096-hybrid',
            'table_name' => 'required_if:scope,table,field|nullable|string|max:64',
            'fields' => 'required_if:scope,field|array',
            'fields.*' => 'string|max:64',
        ]);

        $connection = $this->clientConnections->resolve($request->attributes->get('secure_db_widget_token'));
        if (! $connection || $connection->health_status !== 'healthy') {
            return $this->corsJson(['message' => 'Connect to your database first using the Connect tab.'], 422);
        }

        EncryptConnectionDataJob::dispatch(
            $connection->id,
            $data['scope'],
            $data['algorithm'],
            $data['table_name'] ?? null,
            $data['fields'] ?? [],
            null,
        );

        $this->audit->log($widget->project, 'encryption', "Widget queued {$data['scope']} encryption", null, $request, true, [
            'widget_id' => $widget->uuid,
        ]);

        return $this->corsJson([
            'message' => 'Encryption job queued. You will be notified when complete.',
        ]);
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $widget = $this->widget($request);
        $limit = min((int) $request->get('limit', 25), 100);

        $logs = SecureDbAuditLog::where('project_id', $widget->project_id)
            ->latest('created_at')
            ->limit($limit)
            ->get(['uuid', 'action', 'description', 'ip_address', 'success', 'created_at', 'metadata']);

        return $this->corsJson(['logs' => $logs]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->header('X-Widget-Token') ?? $request->input('widget_token');
        if ($token) {
            $this->clientConnections->disconnect($token);
            Cache::forget("secure_db_widget_session:{$token}");
        }

        return $this->corsJson(['message' => 'Session ended.']);
    }

    protected function widget(Request $request): SecureDbWidget
    {
        return $request->attributes->get('secure_db_widget');
    }

    protected function widgetPayload(SecureDbWidget $widget): array
    {
        return [
            'uuid' => $widget->uuid,
            'name' => $widget->name,
            'language' => $widget->language,
            'database_type' => $widget->database_type,
            'database_label' => WidgetService::DATABASE_MARKET[$widget->database_type]['label'] ?? $widget->database_type,
            'project_name' => $widget->project?->name,
            'requires_client_connection' => true,
        ];
    }

    protected function originAllowed(Request $request, SecureDbWidget $widget): bool
    {
        $allowed = $widget->allowed_origins ?? [];
        if ($allowed === []) {
            return true;
        }

        $origin = $request->header('Origin') ?? $request->header('Referer');
        if (! $origin) {
            return true;
        }

        foreach ($allowed as $pattern) {
            if (str_contains($origin, $pattern)) {
                return true;
            }
        }

        return false;
    }

    protected function corsJson(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, X-Widget-Token');
    }
}
