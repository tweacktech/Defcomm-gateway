<?php

namespace App\Http\Controllers;

use App\Models\VaultItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class VaultController extends Controller
{
    /**
     * Render the vault page with paginated items (values excluded).
     */
    public function index(Request $request): Response
    {
        $vault_items = VaultItem::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate(10, ['id', 'name', 'description', 'created_at', 'updated_at'])
            ->withQueryString();

        return Inertia::render('settings/vault', [
            'vault_items' => $vault_items,
            'revealed_item' => null,
        ]);
    }

    /**
     * Re-render the vault page with one item's decrypted value exposed.
     */
    public function show(Request $request, VaultItem $vaultItem): Response
    {
        $this->authorizeOwner($request, $vaultItem);

        $vault_items = VaultItem::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate(10, ['id', 'name', 'description', 'created_at', 'updated_at'])
            ->withQueryString();

        return Inertia::render('settings/vault', [
            'vault_items' => $vault_items,
            'revealed_item' => [
                'id' => $vaultItem->id,
                'name' => $vaultItem->name,
                'description' => $vaultItem->description,
                'value' => decrypt($vaultItem->value),
                'created_at' => $vaultItem->created_at,
                'updated_at' => $vaultItem->updated_at,
            ],
        ]);
    }

    /**
     * Store one or many vault items.
     *
     * Accepts either:
     *   - Single:  { name, value, description }
     *   - Bulk:    { items: [{ name, value, description }, ...] }
     */
    public function store(Request $request): RedirectResponse
    {
        $userId = $request->user()->id;

        if ($request->has('items')) {
            // ── Bulk insert ───────────────────────────────────────────────
            $validated = $request->validate([
                'items' => ['required', 'array', 'min:1', 'max:100'],
                'items.*.name' => ['required', 'string', 'max:255'],
                'items.*.value' => ['required', 'string'],
                'items.*.description' => ['nullable', 'string'],
            ]);

            $now = now();
            $rows = array_map(fn ($item) => [
                'user_id' => $userId,
                'name' => $item['name'],
                'value' => encrypt($item['value']),
                'description' => $item['description'] ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ], $validated['items']);

            // Insert in chunks to keep query size reasonable
            foreach (array_chunk($rows, 25) as $chunk) {
                DB::table('vault_items')->insert($chunk);
            }

            $count = count($rows);

            return redirect()->back()->with('success', "{$count} vault items created successfully.");
        }

        // ── Single insert ─────────────────────────────────────────────────
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'value' => ['required', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        VaultItem::create([
            'user_id' => $userId,
            'name' => $validated['name'],
            'value' => encrypt($validated['value']),
            'description' => $validated['description'] ?? null,
        ]);

        return redirect()->back()->with('success', 'Vault item created successfully.');
    }

    /**
     * Update an existing vault item.
     */
    public function update(Request $request, VaultItem $vaultItem): RedirectResponse
    {
        $this->authorizeOwner($request, $vaultItem);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'value' => ['sometimes', 'nullable', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        $vaultItem->fill([
            'name' => $validated['name'] ?? $vaultItem->name,
            'value' => !empty($validated['value'])
                                 ? encrypt($validated['value'])
                                 : $vaultItem->value,
            'description' => array_key_exists('description', $validated)
                                 ? $validated['description']
                                 : $vaultItem->description,
        ])->save();

        return redirect()->back()->with('success', 'Vault item updated.');
    }

    /**
     * Delete a vault item permanently.
     */
    public function destroy(Request $request, VaultItem $vaultItem): RedirectResponse
    {
        try {
            $this->authorizeOwner($request, $vaultItem);
            $vaultItem->delete();

            return redirect()->back()->with('success', 'Vault item deleted.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    // -------------------------------------------------------------------------

    private function authorizeOwner(Request $request, VaultItem $vaultItem): void
    {
       if ((int) $vaultItem->user_id !== (int) $request->user()->id) {
            abort(403, 'You do not have permission to access this vault item.');
        }
    }
}
