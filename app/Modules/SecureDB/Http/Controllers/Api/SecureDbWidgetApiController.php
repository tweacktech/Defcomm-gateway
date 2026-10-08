<?php

namespace App\Modules\SecureDB\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\SecureDB\Jobs\EncryptConnectionDataJob;
use App\Modules\SecureDB\Models\SecureDbAuditLog;
use App\Modules\SecureDB\Models\SecureDbWidget;
use App\Modules\SecureDB\Models\SecureDbWidgetAppKey;
use App\Modules\SecureDB\Services\AuditService;
use App\Modules\SecureDB\Services\DatabaseEncryptionService;
use App\Modules\SecureDB\Services\EncryptionService;
use App\Modules\SecureDB\Services\KeyManagementService;
use App\Modules\SecureDB\Services\WidgetAppKeyService;
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
        protected WidgetAppKeyService $appKeys,
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

        if (! $this->widgets->originIsAllowed($widget, $request->header('Origin'), $request->header('Referer'))) {
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

        $pending = \App\Modules\SecureDB\Models\SecureDbJob::where('connection_id', $connection->id)
            ->where('job_type', 'encrypt')
            ->whereIn('status', ['pending', 'running'])
            ->exists();

        if ($pending) {
            return $this->corsJson(['message' => 'A job is already running for this connection. Wait for it to finish.'], 422);
        }

        $job = \App\Modules\SecureDB\Models\SecureDbJob::create([
            'project_id' => $widget->project_id,
            'connection_id' => $connection->id,
            'job_type' => 'encrypt',
            'status' => 'pending',
            'payload' => [
                'operation' => 'encrypt',
                'scope' => $data['scope'],
                'algorithm' => $data['algorithm'],
                'table' => $data['table_name'] ?? null,
                'fields' => $data['fields'] ?? [],
            ],
        ]);

        EncryptConnectionDataJob::dispatch(
            $connection->id,
            $data['scope'],
            $data['algorithm'],
            $data['table_name'] ?? null,
            $data['fields'] ?? [],
            null,
            $job->id,
            'encrypt',
        );

        $this->audit->log($widget->project, 'encryption', "Widget queued {$data['scope']} encryption", null, $request, true, [
            'widget_id' => $widget->uuid,
            'job_uuid' => $job->uuid,
        ]);

        return $this->corsJson([
            'message' => 'Encryption started.',
            'job' => [
                'uuid' => $job->uuid,
                'status' => $job->status,
                'operation' => 'encrypt',
                'percent' => 0,
            ],
        ]);
    }

    public function queueDatabaseDecryption(Request $request): JsonResponse
    {
        $widget = $this->widget($request);
        $data = $request->validate([
            'scope' => 'nullable|in:database,table',
            'table_name' => 'nullable|string|max:64',
        ]);

        $connection = $this->clientConnections->resolve($request->attributes->get('secure_db_widget_token'));
        if (! $connection || $connection->health_status !== 'healthy') {
            return $this->corsJson(['message' => 'Connect to your database first using the Connect tab.'], 422);
        }

        $scope = $data['scope'] ?? ($data['table_name'] ? 'table' : 'database');

        $pending = \App\Modules\SecureDB\Models\SecureDbJob::where('connection_id', $connection->id)
            ->where('job_type', 'encrypt')
            ->whereIn('status', ['pending', 'running'])
            ->exists();

        if ($pending) {
            return $this->corsJson(['message' => 'A job is already running for this connection. Wait for it to finish.'], 422);
        }

        $job = \App\Modules\SecureDB\Models\SecureDbJob::create([
            'project_id' => $widget->project_id,
            'connection_id' => $connection->id,
            'job_type' => 'encrypt',
            'status' => 'pending',
            'payload' => [
                'operation' => 'decrypt',
                'scope' => $scope,
                'table' => $data['table_name'] ?? null,
            ],
        ]);

        EncryptConnectionDataJob::dispatch(
            $connection->id,
            $scope,
            'aes-256-gcm',
            $data['table_name'] ?? null,
            [],
            null,
            $job->id,
            'decrypt',
        );

        $this->audit->log($widget->project, 'decryption', "Widget queued {$scope} decryption", null, $request, true, [
            'widget_id' => $widget->uuid,
            'job_uuid' => $job->uuid,
        ]);

        return $this->corsJson([
            'message' => 'Decryption started.',
            'job' => [
                'uuid' => $job->uuid,
                'status' => $job->status,
                'operation' => 'decrypt',
                'percent' => 0,
            ],
        ]);
    }

    public function jobStatus(Request $request, string $job): JsonResponse
    {
        $widget = $this->widget($request);
        $record = \App\Modules\SecureDB\Models\SecureDbJob::query()
            ->where('uuid', $job)
            ->where('project_id', $widget->project_id)
            ->firstOrFail();

        $cached = Cache::get('secure_db_job:'.$record->uuid);
        $result = is_array($cached) ? $cached : (is_array($record->result) ? $record->result : []);

        return $this->corsJson([
            'uuid' => $record->uuid,
            'status' => $result['status'] ?? $record->status,
            'operation' => $result['operation'] ?? ($record->payload['operation'] ?? 'encrypt'),
            'percent' => (int) ($result['percent'] ?? ($record->status === 'completed' ? 100 : 0)),
            'processed' => $result['processed'] ?? null,
            'total' => $result['total'] ?? null,
            'table' => $result['table'] ?? null,
            'message' => $result['message'] ?? $record->error_message,
            'error_message' => $record->error_message,
            'result' => $record->status === 'completed' ? $record->result : null,
        ]);
    }

    public function encryptedObjects(Request $request): JsonResponse
    {
        $connection = $this->clientConnections->resolve($request->attributes->get('secure_db_widget_token'));
        if (! $connection) {
            return $this->corsJson(['message' => 'Connect to your database first using the Connect tab.'], 422);
        }

        $encryption = app(DatabaseEncryptionService::class);

        return $this->corsJson([
            'objects' => $encryption->listEncryptedObjects($connection),
        ]);
    }

    public function decryptValue(Request $request): JsonResponse
    {
        $widget = $this->widget($request);
        $data = $request->validate([
            'value' => 'required|string|max:65535',
        ]);

        $project = $widget->project;
        $key = $project->activeKey();
        if (! $key) {
            return $this->corsJson(['message' => 'No active encryption key for this project.'], 422);
        }

        try {
            $dek = $this->kms->getDecryptedKey($key);
            $plaintext = $this->encryption->decryptField($data['value'], $dek);
        } catch (\Throwable $e) {
            return $this->corsJson(['message' => $e->getMessage()], 422);
        }

        $this->audit->log($project, 'decryption', 'Widget field decryption', null, $request, true, [
            'widget_id' => $widget->uuid,
        ]);

        return $this->corsJson([
            'decrypted' => $plaintext,
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

    public function listAppKeys(Request $request): JsonResponse
    {
        $widget = $this->widget($request);

        return $this->corsJson([
            'keys' => $this->appKeys->listForWidget($widget),
            'gateway_url' => rtrim(config('app.url'), '/'),
        ]);
    }

    public function storeAppKey(Request $request): JsonResponse
    {
        $widget = $this->widget($request);
        $data = $request->validate([
            'name' => 'required|string|max:120',
        ]);

        $result = $this->appKeys->create($widget, $data['name']);
        $this->audit->log($widget->project, 'key_rotation', "Widget app API key created: {$data['name']}", null, $request, true, [
            'widget_id' => $widget->uuid,
        ]);

        return $this->corsJson([
            'message' => 'Save this key now. It will not be shown again.',
            'plain_key' => $result['plain_key'],
            'key' => [
                'uuid' => $result['key']->uuid,
                'name' => $result['key']->name,
                'key_prefix' => $result['key']->key_prefix,
                'created_at' => $result['key']->created_at?->toIso8601String(),
            ],
            'gateway_url' => rtrim(config('app.url'), '/'),
        ]);
    }

    public function revokeAppKey(Request $request, SecureDbWidgetAppKey $appKey): JsonResponse
    {
        $widget = $this->widget($request);
        $this->appKeys->revoke($widget, $appKey);
        $this->audit->log($widget->project, 'key_rotation', "Widget app API key revoked: {$appKey->name}", null, $request, true, [
            'widget_id' => $widget->uuid,
        ]);

        return $this->corsJson(['message' => 'API key revoked.']);
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

    protected function corsJson(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, X-Widget-Token');
    }
}
