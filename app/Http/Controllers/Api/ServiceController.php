<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    /**
     * List services the authenticated user / client can access.
     */
    public function index(Request $request): JsonResponse
    {
        $services = Service::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get([
                'key',
                'name',
                'description',
            ]);

        return response()->json([
            'data' => $services,
        ]);
    }
}

