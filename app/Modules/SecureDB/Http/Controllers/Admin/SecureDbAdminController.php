<?php

namespace App\Modules\SecureDB\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\SecureDB\Jobs\EncryptDatabaseJob;
use App\Modules\SecureDB\Jobs\HealthCheckJob;
use App\Modules\SecureDB\Jobs\RotateKeysJob;
use App\Modules\SecureDB\Jobs\SyncConnectionSchemaJob;
use App\Modules\SecureDB\Models\SecureDbAuditLog;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbDevice;
use App\Modules\SecureDB\Models\SecureDbEncryptionPolicy;
use App\Modules\SecureDB\Models\SecureDbKey;
use App\Modules\SecureDB\Models\SecureDbNotification;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Models\SecureDbSetting;
use App\Modules\SecureDB\Models\SecureDbWebhook;
use App\Modules\SecureDB\Services\AuditService;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\DatabaseEncryptionService;
use App\Modules\SecureDB\Services\KeyManagementService;
use App\Modules\SecureDB\Services\MonitoringService;
use App\Modules\SecureDB\Services\ReportService;
use App\Modules\SecureDB\Services\WebhookService;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SecureDbAdminController extends Controller
{
    use LogsActivity;

    public function __construct(
        protected ConnectionService $connections,
        protected KeyManagementService $kms,
        protected AuditService $audit,
        protected MonitoringService $monitoring,
        protected ReportService $reports,
        protected WebhookService $webhooks,
    ) {}

    public function dashboard(Request $request): Response
    {
        $this->requireAdmin($request);

        $today = now()->startOfDay();
        $stats = [
            'projects' => SecureDbProject::count(),
            'active_projects' => SecureDbProject::where('status', 'active')->count(),
            'connections' => SecureDbConnection::count(),
            'healthy_connections' => SecureDbConnection::where('health_status', 'healthy')->count(),
            'encrypted_records' => SecureDbProject::sum('encrypted_records_count'),
            'rotations_today' => \App\Modules\SecureDB\Models\SecureDbRotationLog::where('started_at', '>=', $today)->count(),
            'active_devices' => SecureDbDevice::where('status', 'approved')->count(),
            'failed_attempts' => SecureDbAuditLog::where('success', false)->where('created_at', '>=', $today)->count(),
        ];

        $charts = [
            'encryption_activity' => $this->chartData('encryption', 7),
            'decryption_requests' => $this->chartData('decryption', 7),
            'rotation_history' => $this->rotationChartData(30),
            'device_activity' => SecureDbDevice::selectRaw('DATE(last_seen_at) as date, count(*) as count')
                ->where('last_seen_at', '>=', now()->subDays(7))
                ->groupBy('date')->orderBy('date')->pluck('count', 'date'),
        ];

        $monitoring = $this->monitoring->getSystemMetrics();
        $monitoring['encryption_performance'] = $this->monitoring->getEncryptionPerformance();

        return Inertia::render('admin/secure-db/dashboard', [
            'stats' => $stats,
            'charts' => $charts,
            'monitoring' => $monitoring,
            'recent_audit' => SecureDbAuditLog::with('user')->latest('created_at')->limit(10)->get(),
        ]);
    }

    public function projects(Request $request): Response
    {
        $this->requireAdmin($request);

        $query = SecureDbProject::with('owner')->latest();
        if ($search = $request->get('search')) {
            $query->where('name', 'like', "%{$search}%");
        }
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        return Inertia::render('admin/secure-db/projects', [
            'projects' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only(['search', 'status']),
            'users' => User::select('id', 'name', 'email')->orderBy('name')->get(),
        ]);
    }

    public function storeProject(Request $request)
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'owner_id' => 'required|exists:users,id',
            'status' => 'in:active,paused,suspended,archived',
            'environment' => 'in:development,staging,production',
            'encryption_mode' => 'in:field,row,collection,document',
            'rotation_interval' => 'in:5_minutes,hourly,daily,weekly,custom',
            'rotation_cron' => 'nullable|string|max:100',
            'default_algorithm' => 'string|max:50',
        ]);

        $secret = Str::random(64);
        $project = SecureDbProject::create([
            ...$data,
            'api_key' => Str::random(32),
            'secret_key_hash' => Hash::make($secret),
            'created_by' => $request->user()->id,
            'status' => $data['status'] ?? 'active',
            'environment' => $data['environment'] ?? 'development',
        ]);

        $this->kms->generateProjectKey($project, 'master', $request->user()->id);
        $this->kms->generateProjectKey($project, 'project', $request->user()->id);
        $this->log('created', "Created Secure DB project \"{$project->name}\"", 'secure_db', $project);
        $this->audit->log($project, 'project_change', 'Project created', $request->user(), $request);

        return redirect()->back()->with('flash', [
            'success' => 'Project created. Secret key (save now): ' . $secret,
        ]);
    }

    public function updateProject(Request $request, SecureDbProject $project)
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'owner_id' => 'sometimes|exists:users,id',
            'status' => 'sometimes|in:active,paused,suspended,archived',
            'environment' => 'sometimes|in:development,staging,production',
            'encryption_mode' => 'sometimes|in:field,row,collection,document',
            'rotation_interval' => 'sometimes|in:5_minutes,hourly,daily,weekly,custom',
            'rotation_cron' => 'nullable|string|max:100',
            'default_algorithm' => 'sometimes|string|max:50',
        ]);

        $project->update([...$data, 'updated_by' => $request->user()->id]);
        $this->audit->log($project, 'project_change', 'Project updated', $request->user(), $request);

        return redirect()->back();
    }

    public function archiveProject(Request $request, SecureDbProject $project)
    {
        $this->requireAdmin($request);
        $project->update(['status' => 'archived', 'updated_by' => $request->user()->id]);

        return redirect()->back();
    }

    public function destroyProject(Request $request, SecureDbProject $project)
    {
        $this->requireAdmin($request);
        $project->delete();
        $this->log('deleted', "Deleted Secure DB project \"{$project->name}\"", 'secure_db');

        return redirect()->back();
    }

    public function connections(Request $request): Response
    {
        $this->requireAdmin($request);
        $query = SecureDbConnection::with('project')->latest();
        if ($projectId = $request->get('project_id')) {
            $query->where('project_id', $projectId);
        }

        return Inertia::render('admin/secure-db/connections', [
            'connections' => $query->paginate(15)->withQueryString(),
            'projects' => SecureDbProject::select('id', 'name', 'uuid')->orderBy('name')->get(),
            'filters' => $request->only(['project_id']),
            'summary' => [
                'total' => SecureDbConnection::count(),
                'online' => SecureDbConnection::where('health_status', 'healthy')->count(),
                'offline' => SecureDbConnection::whereIn('health_status', ['unhealthy', 'degraded'])->count(),
                'tables' => SecureDbConnection::sum('table_count'),
                'records' => SecureDbConnection::sum('record_count_estimate'),
            ],
            'algorithms' => DatabaseEncryptionService::supportedAlgorithms(),
        ]);
    }

    public function storeConnection(Request $request)
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'project_id' => 'required|exists:secure_db_projects,id',
            'name' => 'required|string|max:255',
            'database_type' => 'required|in:mysql,postgresql,sqlserver,mariadb,mongodb,redis',
            'host' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'database_name' => 'required_unless:database_type,redis|string|max:255|nullable',
            'username' => 'nullable|string|max:255',
            'password' => 'nullable|string',
            'ssl_enabled' => 'boolean',
            'ssh_tunnel_enabled' => 'boolean',
            'auto_reconnect' => 'boolean',
            'connection_timeout' => 'nullable|integer|min:1|max:120',
            'charset' => 'nullable|string|max:64',
            'collation' => 'nullable|string|max:64',
            'redis_database' => 'nullable|integer|min:0|max:15',
        ]);

        $encrypted = $this->connections->encryptCredentials(
            $data['username'] ?? '',
            $data['password'] ?? '',
        );

        $connection = SecureDbConnection::create([
            'project_id' => $data['project_id'],
            'name' => $data['name'],
            'database_type' => $data['database_type'],
            'host' => $data['host'],
            'port' => $data['port'] ?: $this->connections->defaultPort($data['database_type']),
            'database_name' => $data['database_name'] ?? ($data['database_type'] === 'redis' ? '0' : ''),
            ...$encrypted,
            'ssl_enabled' => $data['ssl_enabled'] ?? false,
            'ssh_tunnel_enabled' => $data['ssh_tunnel_enabled'] ?? false,
            'auto_reconnect' => $data['auto_reconnect'] ?? true,
            'connection_timeout' => $data['connection_timeout'] ?? 10,
            'charset' => $data['charset'] ?? null,
            'collation' => $data['collation'] ?? null,
            'redis_database' => $data['redis_database'] ?? 0,
            'created_by' => $request->user()->id,
        ]);

        $test = $this->connections->testConnectionDetailed($connection);
        if ($test->success) {
            SyncConnectionSchemaJob::dispatch($connection);
        }
        $this->audit->log($connection->project, 'connection_change', "Connection {$connection->name} created", $request->user(), $request);

        $redirect = redirect()->back()->with('connection_test', $test->toArray());

        if ($test->success) {
            return $redirect->with('success', 'Connection saved and verified successfully.');
        }

        return $redirect;
    }

    public function updateConnection(Request $request, SecureDbConnection $connection)
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'project_id' => 'required|exists:secure_db_projects,id',
            'name' => 'required|string|max:255',
            'database_type' => 'required|in:mysql,postgresql,sqlserver,mariadb,mongodb,redis',
            'host' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'database_name' => 'required_unless:database_type,redis|string|max:255|nullable',
            'username' => 'nullable|string|max:255',
            'password' => 'nullable|string',
            'ssl_enabled' => 'boolean',
            'ssh_tunnel_enabled' => 'boolean',
            'auto_reconnect' => 'boolean',
            'connection_timeout' => 'nullable|integer|min:1|max:120',
            'charset' => 'nullable|string|max:64',
            'collation' => 'nullable|string|max:64',
            'redis_database' => 'nullable|integer|min:0|max:15',
        ]);

        $updates = [
            'project_id' => $data['project_id'],
            'name' => $data['name'],
            'database_type' => $data['database_type'],
            'host' => $data['host'],
            'port' => $data['port'] ?: $this->connections->defaultPort($data['database_type']),
            'database_name' => $data['database_name'] ?? ($data['database_type'] === 'redis' ? '0' : ''),
            'ssl_enabled' => $data['ssl_enabled'] ?? false,
            'ssh_tunnel_enabled' => $data['ssh_tunnel_enabled'] ?? false,
            'auto_reconnect' => $data['auto_reconnect'] ?? true,
            'connection_timeout' => $data['connection_timeout'] ?? 10,
            'charset' => $data['charset'] ?? null,
            'collation' => $data['collation'] ?? null,
            'redis_database' => $data['redis_database'] ?? 0,
            'updated_by' => $request->user()->id,
        ];

        if (array_key_exists('username', $data) && $data['username'] !== null && $data['username'] !== '') {
            $encrypted = $this->connections->encryptCredentials(
                $data['username'],
                $data['password'] ?? '',
            );
            $updates['username_encrypted'] = $encrypted['username_encrypted'];
            if (! empty($data['password'])) {
                $updates['password_encrypted'] = $encrypted['password_encrypted'];
            }
        } elseif (! empty($data['password'])) {
            $creds = $this->connections->decryptCredentials($connection);
            $encrypted = $this->connections->encryptCredentials($creds['username'], $data['password']);
            $updates['password_encrypted'] = $encrypted['password_encrypted'];
        }

        $connection->update($updates);

        $test = $this->connections->testConnectionDetailed($connection->fresh());
        if ($test->success) {
            SyncConnectionSchemaJob::dispatch($connection);
        }
        $this->audit->log($connection->project, 'connection_change', "Connection {$connection->name} updated", $request->user(), $request);

        $redirect = redirect()->back()->with('connection_test', $test->toArray());

        if ($test->success) {
            return $redirect->with('success', 'Connection updated and verified successfully.');
        }

        return $redirect;
    }

    public function testConnection(Request $request, SecureDbConnection $connection)
    {
        $this->requireAdmin($request);
        $result = $this->connections->testConnectionDetailed($connection);

        if ($request->wantsJson()) {
            return response()->json($result->toArray());
        }

        return redirect()->back()->with('flash', [
            $result->success ? 'success' : 'error' => $result->success
                ? 'Connection successful. Ping: ' . ($result->pingMs ?? 0) . 'ms'
                : ($result->message ?? 'Connection failed.'),
        ]);
    }

    public function destroyConnection(Request $request, SecureDbConnection $connection)
    {
        $this->requireAdmin($request);
        $connection->delete();

        return redirect()->back();
    }

    public function policies(Request $request): Response
    {
        $this->requireAdmin($request);

        return Inertia::render('admin/secure-db/policies', [
            'policies' => SecureDbEncryptionPolicy::with(['project', 'connection'])->latest()->paginate(15),
            'projects' => SecureDbProject::select('id', 'name')->orderBy('name')->get(),
            'connections' => SecureDbConnection::select('id', 'name', 'project_id')->get(),
        ]);
    }

    public function storePolicy(Request $request)
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'project_id' => 'required|exists:secure_db_projects,id',
            'connection_id' => 'nullable|exists:secure_db_connections,id',
            'name' => 'required|string|max:255',
            'scope' => 'required|in:field,row,collection,document',
            'target_table' => 'nullable|string|max:255',
            'target_collection' => 'nullable|string|max:255',
            'sensitive_fields' => 'nullable|array',
            'algorithm' => 'string|max:50',
            'is_active' => 'boolean',
        ]);

        SecureDbEncryptionPolicy::create([
            ...$data,
            'created_by' => $request->user()->id,
            'sensitive_fields' => $data['sensitive_fields'] ?? [],
        ]);

        return redirect()->back();
    }

    public function keys(Request $request): Response
    {
        $this->requireAdmin($request);

        return Inertia::render('admin/secure-db/keys', [
            'keys' => SecureDbKey::with('project')->latest()->paginate(15),
            'projects' => SecureDbProject::select('id', 'name', 'uuid')->get(),
        ]);
    }

    public function rotateKey(Request $request, SecureDbProject $project)
    {
        $this->requireAdmin($request);
        RotateKeysJob::dispatch($project);

        return redirect()->back()->with('flash', ['success' => 'Key rotation queued.']);
    }

    public function revokeKey(Request $request, SecureDbKey $key)
    {
        $this->requireAdmin($request);
        $this->kms->revokeKey($key);

        return redirect()->back();
    }

    public function devices(Request $request): Response
    {
        $this->requireAdmin($request);
        $query = SecureDbDevice::with(['project', 'user'])->latest();
        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        return Inertia::render('admin/secure-db/devices', [
            'devices' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only(['status']),
        ]);
    }

    public function updateDeviceStatus(Request $request, SecureDbDevice $device)
    {
        $this->requireAdmin($request);
        $data = $request->validate(['status' => 'required|in:approved,revoked,blocked']);

        $device->update([
            'status' => $data['status'],
            'approved_by' => $data['status'] === 'approved' ? $request->user()->id : $device->approved_by,
            'approved_at' => $data['status'] === 'approved' ? now() : $device->approved_at,
        ]);

        $this->audit->log($device->project, 'device_change', "Device {$device->device_name} set to {$data['status']}", $request->user(), $request);

        return redirect()->back();
    }

    public function auditLogs(Request $request): Response
    {
        $this->requireAdmin($request);
        $query = SecureDbAuditLog::with(['user', 'project'])->latest('created_at');
        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }

        return Inertia::render('admin/secure-db/audit-logs', [
            'logs' => $query->paginate(20)->withQueryString(),
            'filters' => $request->only(['action']),
        ]);
    }

    public function exportAudit(Request $request, string $format): StreamedResponse
    {
        $this->requireAdmin($request);
        $logs = SecureDbAuditLog::with('user')->latest('created_at')->limit(1000)->get();

        $content = match ($format) {
            'csv', 'excel' => $this->audit->exportCsv($logs),
            'pdf' => $this->audit->exportPdf($logs),
            default => abort(404),
        };

        $mime = match ($format) {
            'pdf' => 'text/plain',
            'excel' => 'application/vnd.ms-excel',
            default => 'text/csv',
        };

        return response()->streamDownload(fn () => print($content), "secure-db-audit.{$format}", ['Content-Type' => $mime]);
    }

    public function notifications(Request $request): Response
    {
        $this->requireAdmin($request);

        return Inertia::render('admin/secure-db/notifications', [
            'notifications' => SecureDbNotification::with('user')->latest()->paginate(20),
        ]);
    }

    public function markNotificationRead(Request $request, SecureDbNotification $notification)
    {
        $this->requireAdmin($request);
        $notification->update(['is_read' => true]);

        return redirect()->back();
    }

    public function reports(Request $request): Response
    {
        $this->requireAdmin($request);
        $projectId = $request->get('project_id');
        $project = $projectId ? SecureDbProject::find($projectId) : SecureDbProject::first();

        $reportData = $project ? [
            'encryption' => $this->reports->encryptionReport($project),
            'decryption' => $this->reports->decryptionReport($project),
            'devices' => $this->reports->deviceReport($project),
            'audit' => $this->reports->auditReport($project),
            'compliance' => $this->reports->complianceReport($project),
        ] : null;

        return Inertia::render('admin/secure-db/reports', [
            'projects' => SecureDbProject::select('id', 'name')->get(),
            'selected_project_id' => $project?->id,
            'reports' => $reportData,
        ]);
    }

    public function settings(Request $request): Response
    {
        $this->requireAdmin($request);

        return Inertia::render('admin/secure-db/settings', [
            'settings' => [
                'default_algorithm' => SecureDbSetting::getValue('default_algorithm', 'aes-256-gcm'),
                'rotation_frequency' => SecureDbSetting::getValue('rotation_frequency', 'daily'),
                'retention_period_days' => SecureDbSetting::getValue('retention_period_days', 365),
                'audit_retention_days' => SecureDbSetting::getValue('audit_retention_days', 730),
                'notification_channels' => SecureDbSetting::getValue('notification_channels', ['in_app', 'email']),
            ],
        ]);
    }

    public function updateSettings(Request $request)
    {
        $this->requireAdmin($request);
        $data = $request->validate([
            'default_algorithm' => 'required|string|max:50',
            'rotation_frequency' => 'required|in:5_minutes,hourly,daily,weekly,custom',
            'retention_period_days' => 'required|integer|min:1',
            'audit_retention_days' => 'required|integer|min:1',
            'notification_channels' => 'required|array',
        ]);

        foreach ($data as $key => $value) {
            SecureDbSetting::setValue($key, $value, $request->user()->id);
        }

        $this->audit->log(null, 'settings_change', 'Secure DB settings updated', $request->user(), $request);

        return redirect()->back();
    }

    public function branding(): Response
    {
        return Inertia::render('admin/secure-db/branding');
    }

    public function runHealthCheck(Request $request)
    {
        $this->requireAdmin($request);
        HealthCheckJob::dispatch();

        return redirect()->back()->with('flash', ['success' => 'Health check queued.']);
    }

    public function runEncryption(Request $request, SecureDbProject $project)
    {
        $this->requireAdmin($request);
        EncryptDatabaseJob::dispatch($project);

        return redirect()->back()->with('flash', ['success' => 'Encryption job queued.']);
    }

    protected function chartData(string $action, int $days): array
    {
        return SecureDbAuditLog::selectRaw('DATE(created_at) as date, count(*) as count')
            ->where('action', $action)
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date')
            ->toArray();
    }

    protected function rotationChartData(int $days): array
    {
        return \App\Modules\SecureDB\Models\SecureDbRotationLog::selectRaw('DATE(started_at) as date, count(*) as count')
            ->where('started_at', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('count', 'date')
            ->toArray();
    }

    protected function requireAdmin(Request $request): void
    {
        if ($request->user()?->role !== 'admin') {
            abort(403);
        }
    }
}
