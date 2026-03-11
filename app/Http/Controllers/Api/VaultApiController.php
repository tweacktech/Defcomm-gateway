<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VaultItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VaultApiController extends Controller
{
    /**
     * List vault items for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            $items = VaultItem::query()
                ->where('user_id', $user->id)
                ->orderByDesc('id')
                ->get(['id', 'name', 'description', 'created_at', 'updated_at']);

            return response()->json([
                'data' => $items,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Vault failed: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Show a single vault item, decrypting its value.
     * Only the owner may view the plaintext value.
     */
    public function show(Request $request, VaultItem $vaultItem): JsonResponse
    {
        try {
            $this->authorizeOwner($request, $vaultItem);

            return response()->json([
                'data' => [
                    'id' => $vaultItem->id,
                    'name' => $vaultItem->name,
                    'value' => decrypt($vaultItem->value),
                    'description' => $vaultItem->description,
                    'created_at' => $vaultItem->created_at,
                    'updated_at' => $vaultItem->updated_at,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Vault failed: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a new vault item for the authenticated user.
     */
    public function store(Request $request): JsonResponse
    {
        try {
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
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Vault failed: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update an existing vault item.
     * Value is re-encrypted on every update.
     */
    public function update(Request $request, VaultItem $vaultItem): JsonResponse
    {
        try {
            $this->authorizeOwner($request, $vaultItem);

            $validated = $request->validate([
                'name' => ['sometimes', 'required', 'string', 'max:255'],
                'value' => ['sometimes', 'required', 'string'],
                'description' => ['nullable', 'string'],
            ]);

            $vaultItem->fill([
                'name' => $validated['name'] ?? $vaultItem->name,
                'value' => isset($validated['value']) ? encrypt($validated['value']) : $vaultItem->value,
                'description' => array_key_exists('description', $validated)
                    ? $validated['description']
                    : $vaultItem->description,
            ])->save();

            return response()->json([
                'data' => [
                    'id' => $vaultItem->id,
                    'name' => $vaultItem->name,
                    'description' => $vaultItem->description,
                    'created_at' => $vaultItem->created_at,
                    'updated_at' => $vaultItem->updated_at,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Vault failed: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a vault item permanently.
     */
    public function destroy(Request $request, VaultItem $vaultItem): JsonResponse
    {
        try {
            $this->authorizeOwner($request, $vaultItem);

            $vaultItem->delete();

            return response()->json(null, 204);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Vault failed: '.$e->getMessage(),
            ], 500);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Abort with 403 if the vault item does not belong to the requesting user.
     */
    private function authorizeOwner(Request $request, VaultItem $vaultItem): void
    {
        try {
            if ($vaultItem->user_id !== $request->user()->id) {
                abort(403, 'You do not have permission to access this vault item.');
            }
        } catch (\Exception $e) {
            abort(403, 'You do not have permission to access this vault item.');
        }
    }
}
