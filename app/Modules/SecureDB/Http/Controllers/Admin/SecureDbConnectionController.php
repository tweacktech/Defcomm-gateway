<?php

namespace App\Modules\SecureDB\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\SecureDB\Jobs\EncryptConnectionDataJob;
use App\Modules\SecureDB\Jobs\SyncConnectionSchemaJob;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbJob;
use App\Modules\SecureDB\Services\AuditService;
use App\Modules\SecureDB\Services\ConnectionService;
use App\Modules\SecureDB\Services\DatabaseDiscoveryService;
use App\Modules\SecureDB\Services\DatabaseEncryptionService;
use App\Modules\SecureDB\Services\DatabaseExplorerFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SecureDbConnectionController extends Controller
{
    public function __construct(
        protected ConnectionService $connections,
        protected DatabaseExplorerFactory $explorers,
        protected DatabaseDiscoveryService $discovery,
        protected AuditService $audit,
    ) {}

    public function explorer(Request $request, SecureDbConnection $connection): Response
    {
        $this->requireAdmin($request);
        $connection->load(['project', 'schemaObjects']);

        $widgets = [
            'health_status' => $connection->health_status,
            'table_count' => $connection->table_count,
            'record_count_estimate' => $connection->record_count_estimate,
            'database_size_bytes' => $connection->database_size_bytes,
            'last_sync_at' => $connection->last_sync_at?->toIso8601String(),
            'last_connected_at' => $connection->last_connected_at?->toIso8601String(),
            'connection_metadata' => $connection->connection_metadata,
        ];

        return Inertia::render('admin/secure-db/connection-explorer', [
            'connection' => $connection->only([
                'uuid', 'name', 'database_type', 'host', 'port', 'database_name',
                'health_status', 'ssl_enabled', 'charset', 'collation', 'redis_database',
                'table_count', 'record_count_estimate', 'database_size_bytes',
                'last_sync_at', 'last_connected_at', 'connection_metadata',
            ]),
            'project' => $connection->project?->only(['id', 'name', 'uuid']),
            'widgets' => $widgets,
            'schema_tree' => $this->buildSchemaTree($connection),
        ]);
    }

    public function test(Request $request, SecureDbConnection $connection): JsonResponse
    {
        $this->requireAdmin($request);
        $result = $this->connections->testConnectionDetailed($connection);
        $this->audit->log($connection->project, 'database_access', 'Connection test: ' . ($result->success ? 'success' : 'failed'), $request->user(), $request, $result->success);

        return response()->json($result->toArray());
    }

    public function sync(Request $request, SecureDbConnection $connection): JsonResponse
    {
        $this->requireAdmin($request);
        SyncConnectionSchemaJob::dispatchSync($connection);

        return response()->json(['success' => true, 'message' => 'Schema synchronized.']);
    }

    public function schema(Request $request, SecureDbConnection $connection): JsonResponse
    {
        $this->requireAdmin($request);

        return response()->json([
            'tree' => $this->buildSchemaTree($connection->fresh()->load('schemaObjects')),
        ]);
    }

    public function metadata(Request $request, SecureDbConnection $connection, string $object): JsonResponse
    {
        $this->requireAdmin($request);
        $explorer = $this->explorers->for($connection);

        try {
            $meta = $explorer->getObjectMetadata($connection, $object, $request->get('schema'));

            return response()->json($meta);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to load metadata.'], 422);
        }
    }

    public function browse(Request $request, SecureDbConnection $connection, string $object): JsonResponse
    {
        $this->requireAdmin($request);
        $explorer = $this->explorers->for($connection);

        try {
            $data = $explorer->browseData(
                $connection,
                $object,
                $request->get('schema'),
                (int) $request->get('page', 1),
                (int) $request->get('per_page', 50),
                $request->get('sort'),
                $request->get('direction', 'asc'),
                $request->get('search'),
                $request->get('filter_column'),
                $request->get('filter_value'),
            );

            return response()->json($data);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Failed to browse data.'], 422);
        }
    }

    public function export(Request $request, SecureDbConnection $connection, string $object): StreamedResponse
    {
        $this->requireAdmin($request);
        $explorer = $this->explorers->for($connection);
        $rows = $explorer->exportData(
            $connection,
            $object,
            $request->get('schema'),
            $request->input('ids', []),
            (int) $request->get('limit', 1000),
        );

        return response()->streamDownload(function () use ($rows) {
            if (empty($rows)) {
                echo '';

                return;
            }
            $out = fopen('php://output', 'w');
            fputcsv($out, array_keys($rows[0]));
            foreach ($rows as $row) {
                fputcsv($out, array_map(fn ($v) => is_array($v) ? json_encode($v) : $v, $row));
            }
            fclose($out);
        }, "{$object}-export.csv", ['Content-Type' => 'text/csv']);
    }

    public function encryptionTargets(Request $request, SecureDbConnection $connection): JsonResponse
    {
        $this->requireAdmin($request);
        $connection->load('schemaObjects');

        $tables = $connection->schemaObjects
            ->where('object_type', 'table')
            ->map(fn ($o) => [
                'name' => $o->object_name,
                'row_count' => $o->row_count_estimate,
                'columns' => collect($o->columns_metadata ?? [])->map(fn ($c) => [
                    'name' => $c['name'] ?? '',
                    'type' => $c['type'] ?? '',
                ])->values(),
            ])
            ->values();

        return response()->json([
            'tables' => $tables,
            'algorithms' => DatabaseEncryptionService::supportedAlgorithms(),
            'supports_encryption' => in_array($connection->database_type, ['mysql', 'mariadb', 'postgresql', 'sqlserver'], true),
        ]);
    }

    public function encrypt(Request $request, SecureDbConnection $connection): JsonResponse
    {
        $this->requireAdmin($request);

        $data = $request->validate([
            'scope' => 'required|in:database,table,field',
            'algorithm' => 'required|in:aes-256-gcm,chacha20-poly1305,rsa-4096-hybrid',
            'table_name' => 'required_if:scope,table,field|nullable|string|max:64',
            'fields' => 'required_if:scope,field|array',
            'fields.*' => 'string|max:64',
        ]);

        if (! in_array($connection->database_type, ['mysql', 'mariadb', 'postgresql', 'sqlserver'], true)) {
            return response()->json(['message' => 'Encryption is only supported for SQL database connections.'], 422);
        }

        if ($connection->health_status !== 'healthy') {
            return response()->json(['message' => 'Connection must be healthy before encryption can run. Test the connection first.'], 422);
        }

        $pending = SecureDbJob::where('connection_id', $connection->id)
            ->where('job_type', 'encrypt')
            ->whereIn('status', ['pending', 'running'])
            ->exists();

        if ($pending) {
            return response()->json(['message' => 'An encryption job is already running for this connection.'], 422);
        }

        EncryptConnectionDataJob::dispatch(
            $connection->id,
            $data['scope'],
            $data['algorithm'],
            $data['table_name'] ?? null,
            $data['fields'] ?? [],
            $request->user()->id,
        );

        $this->audit->log(
            $connection->project,
            'encryption',
            "Encryption queued ({$data['scope']}) for connection {$connection->name}",
            $request->user(),
            $request,
        );

        return response()->json([
            'success' => true,
            'message' => 'Encryption has been queued. You will receive an email when it completes.',
        ]);
    }

    public function encryptionJobs(Request $request, SecureDbConnection $connection): JsonResponse
    {
        $this->requireAdmin($request);

        $jobs = SecureDbJob::where('connection_id', $connection->id)
            ->where('job_type', 'encrypt')
            ->latest()
            ->limit(5)
            ->get(['uuid', 'status', 'payload', 'result', 'error_message', 'started_at', 'completed_at']);

        return response()->json(['jobs' => $jobs]);
    }

    protected function buildSchemaTree(SecureDbConnection $connection): array
    {
        $grouped = $connection->schemaObjects->groupBy('object_type');

        return [
            'tables' => ($grouped->get('table') ?? collect())->values()->map(fn ($o) => [
                'name' => $o->object_name,
                'row_count' => $o->row_count_estimate,
                'size_bytes' => $o->size_bytes,
            ]),
            'views' => ($grouped->get('view') ?? collect())->pluck('object_name'),
            'procedures' => ($grouped->get('procedure') ?? collect())->pluck('object_name'),
            'functions' => ($grouped->get('function') ?? collect())->pluck('object_name'),
            'triggers' => ($grouped->get('trigger') ?? collect())->pluck('object_name'),
            'collections' => ($grouped->get('collection') ?? collect())->map(fn ($o) => [
                'name' => $o->object_name,
                'row_count' => $o->row_count_estimate,
            ])->values(),
            'keys' => ($grouped->get('key') ?? collect())->map(fn ($o) => [
                'name' => $o->object_name,
                'type' => $o->columns_metadata['type'] ?? 'unknown',
            ])->values(),
        ];
    }

    protected function requireAdmin(Request $request): void
    {
        if ($request->user()?->role !== 'admin') {
            abort(403);
        }
    }
}
