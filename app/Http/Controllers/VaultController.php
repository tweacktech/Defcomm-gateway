<?php

namespace App\Http\Controllers;

use App\Models\VaultItem;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use Log;

class VaultController extends Controller
{
    /**
     * Render the vault page with all items (values excluded).
     */
    public function index(Request $request): Response
    {
        $items = VaultItem::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get(['id', 'name', 'description', 'created_at', 'updated_at']);

        return Inertia::render('settings/vault', [
            'vault_items' => $items,
        ]);
    }

    /**
     * Re-render the vault page with one item's decrypted value exposed.
     * The frontend reads `revealed_item` to show the value inline.
     */
    public function show(Request $request, VaultItem $vaultItem): Response
    {
        return $
        $this->authorizeOwner($request, $vaultItem);

        $items = VaultItem::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get(['id', 'name', 'description', 'created_at', 'updated_at']);

        return Inertia::render('settings/vault', [
            'vault_items'   => $items,
            'revealed_item' => [
                'id'          => $vaultItem->id,
                'name'        => $vaultItem->name,
                'description' => $vaultItem->description,
                'value'       => decrypt($vaultItem->value),
                'created_at'  => $vaultItem->created_at,
                'updated_at'  => $vaultItem->updated_at,
            ],
        ]);
    }

    /**
     * Store a new vault item.
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'value'       => ['required', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        VaultItem::create([
            'user_id'     => $request->user()->id,
            'name'        => $validated['name'],
            'value'       => encrypt($validated['value']),
            'description' => $validated['description'] ?? null,
        ]);

        return redirect()->back()->with('success', 'Vault item created successfully.');
    }

    /**
     * Update an existing vault item.
     * Re-encrypts value only when a new one is supplied.
     */
    public function update(Request $request, VaultItem $vaultItem): RedirectResponse
    {
        $this->authorizeOwner($request, $vaultItem);

        $validated = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'max:255'],
            'value'       => ['sometimes', 'nullable', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        $vaultItem->fill([
            'name'        => $validated['name'] ?? $vaultItem->name,
            'value'       => !empty($validated['value'])
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
        $this->authorizeOwner($request, $vaultItem);

        $vaultItem->delete();

        return redirect()->back()->with('success', 'Vault item deleted.');
    }

    // -------------------------------------------------------------------------

    private function authorizeOwner(Request $request, VaultItem $vaultItem): void
    {
        Log::info('Authorizing vault item access', [
            'vault_item_id' => $vaultItem->id,
            'vault_item_user_id' => $vaultItem->user_id,
            'request_user_id' => $request->user()->id,
        ]);
        if ((int) $vaultItem->user_id !== (int) $request->user()->id) {
            abort(403, 'You do not have permission to access this vault item.');
        }
    }
}