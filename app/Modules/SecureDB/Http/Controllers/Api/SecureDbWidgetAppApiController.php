<?php

namespace App\Modules\SecureDB\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Modules\SecureDB\Models\SecureDbWidget;
use App\Modules\SecureDB\Services\WidgetQueryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SecureDbWidgetAppApiController extends Controller
{
    public function __construct(
        protected WidgetQueryService $queries,
    ) {}

    public function tables(Request $request): JsonResponse
    {
        try {
            return $this->ok($this->queries->tables($this->widget($request)));
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage(), 422);
        }
    }

    public function query(Request $request): JsonResponse
    {
        $data = $request->validate([
            'table' => 'required|string|max:64',
            'search' => 'nullable|string|max:255',
            'filter_column' => 'nullable|string|max:64',
            'filter_value' => 'nullable|string|max:255',
            'sort_column' => 'nullable|string|max:64',
            'sort_direction' => 'nullable|in:asc,desc',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:200',
            'decrypt' => 'nullable|boolean',
        ]);

        try {
            return $this->ok($this->queries->query($this->widget($request), $data), 'Query successful.');
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage(), 422);
        }
    }

    public function decrypt(Request $request): JsonResponse
    {
        $data = $request->validate([
            'value' => 'required|string|max:65535',
        ]);

        try {
            return $this->ok([
                'decrypted' => $this->queries->decryptValue($this->widget($request), $data['value']),
            ], 'Decryption successful.');
        } catch (\Throwable $e) {
            return $this->fail($e->getMessage(), 422);
        }
    }

    protected function widget(Request $request): SecureDbWidget
    {
        return $request->attributes->get('secure_db_widget');
    }

    protected function ok(array $data, string $message = 'OK'): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data])
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Secure-DB-App-Key');
    }

    protected function fail(string $message, int $status = 422): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message], $status)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Secure-DB-App-Key');
    }
}
