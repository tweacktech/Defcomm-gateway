<?php

namespace App\Http\Controllers;

use App\Models\Service;
use App\Traits\LogsActivity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ServiceController extends Controller
{
    use LogsActivity;

    // ── Pages ─────────────────────────────────────────────────────────────────

    /**
     * GET /admin/services
     */
    public function index(Request $request): Response
    {
        // $this->requireAdmin($request);

        $search = $request->input('search', '');
        $status = $request->input('status', 'all'); // all | active | inactive

        $services = Service::query()
            ->when($search, fn ($q) =>
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('key', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
            )
            ->when($status === 'active',   fn ($q) => $q->where('is_active', true))
            ->when($status === 'inactive', fn ($q) => $q->where('is_active', false))
            ->orderBy('name')
            ->paginate(15)
            ->through(fn ($s) => $this->serviceResource($s));

        return Inertia::render('admin/admin-services-index', [
            'services' => $services,
            'filters'  => compact('search', 'status'),
            'summary'  => $this->summary(),
        ]);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /**
     * POST /admin/services
     */
    public function store(Request $request): RedirectResponse
    {
        $this->requireAdmin($request);

        $validated = $request->validate([
            'key'         => ['required', 'string', 'max:100', 'unique:services,key'],
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_active'   => ['boolean'],
        ]);

        $service = Service::create($validated);

        $this->log('created', "Created service \"{$service->name}\"", 'service', $service);

        return redirect()->back()->with('success', "Service \"{$service->name}\" created.");
    }

    /**
     * PATCH /admin/services/{service}
     */
    public function update(Request $request, Service $service): RedirectResponse
    {
        $this->requireAdmin($request);

        $validated = $request->validate([
            'key'         => ['required', 'string', 'max:100',
                              Rule::unique('services', 'key')->ignore($service->id)],
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_active'   => ['boolean'],
        ]);

        $service->update($validated);

        $this->log('updated', "Updated service \"{$service->name}\"", 'service', $service);

        return redirect()->back()->with('success', "Service \"{$service->name}\" updated.");
    }

    /**
     * PATCH /admin/services/{service}/toggle
     * Flip is_active without opening the edit form.
     */
    public function toggle(Request $request, Service $service): RedirectResponse
    {
        $this->requireAdmin($request);

        $service->update(['is_active' => ! $service->is_active]);

        $state = $service->is_active ? 'activated' : 'deactivated';

        $this->log($state, "Service \"{$service->name}\" {$state}", 'service', $service);

        return redirect()->back()->with('success', "Service \"{$service->name}\" {$state}.");
    }

    /**
     * DELETE /admin/services/{service}
     */
    public function destroy(Request $request, Service $service): RedirectResponse
    {
        $this->requireAdmin($request);

        $name = $service->name;
        $service->delete();

        $this->log('deleted', "Deleted service \"{$name}\"", 'service');

        return redirect()->back()->with('success', "Service \"{$name}\" deleted.");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function requireAdmin(Request $request): void
    {
        if (!$request->user()?->role == 'admin') {
            abort(403);
        }
    }

    private function serviceResource(Service $service): array
    {
        return [
            'id'          => $service->id,
            'key'         => $service->key,
            'name'        => $service->name,
            'description' => $service->description,
            'is_active'   => $service->is_active,
            'created_at'  => $service->created_at->toIso8601String(),
            'created_ago' => $service->created_at->diffForHumans(),
            'updated_ago' => $service->updated_at->diffForHumans(),
        ];
    }

    public function summary(): array
    {
        return [
            'total'    => Service::count(),
            'active'   => Service::where('is_active', true)->count(),
            'inactive' => Service::where('is_active', false)->count(),
        ];
    }
}
