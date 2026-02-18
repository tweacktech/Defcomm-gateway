<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VaultItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VaultController extends Controller
{
    /**
     * List vault items for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $items = VaultItem::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->get([
                'id',
                'name',
                'description',
                'created_at',
                'updated_at',
            ]);

        return response()->json([
            'data' => $items,
        ]);
    }

    /**
     * Store a new vault item for the authenticated user.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'value' => ['required', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        $item = VaultItem::create([
            'user_id' => $user->id,
            'name' => $validated['name'],
            'value' => encrypt($validated['value']),
            'description' => $validated['description'] ?? null,
        ]);

        return response()->json([
            'data' => [
                'id' => $item->id,
                'name' => $item->name,
                'description' => $item->description,
                'created_at' => $item->created_at,
                'updated_at' => $item->updated_at,
            ],
        ], 201);
    }
}

