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

    public function index(Request $request): Response
    {
        $this->requireSuperAdmin($request);

        $search = $request->input('search', '');
        $status = $request->input('status', 'all');

        $services = Service::query()
            ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('key', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            }))
            ->when($status === 'active', fn ($q) => $q->where('is_active', true))
            ->when($status === 'inactive', fn ($q) => $q->where('is_active', false))
            ->orderBy('name')
            ->paginate(15)
            ->through(fn ($s) => $this->serviceResource($s));

        return Inertia::render('admin/admin-services-index', [
            'services' => $services,
            'filters' => compact('search', 'status'),
            'summary' => $this->summary(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->requireSuperAdmin($request);

        $validated = $this->validateService($request);

        $service = Service::create($validated);

        $this->log('created', "Created service \"{$service->name}\"", 'service', $service);

        return redirect()->back()->with('success', "Service \"{$service->name}\" created.");
    }

    public function update(Request $request, Service $service): RedirectResponse
    {
        $this->requireSuperAdmin($request);

        $validated = $this->validateService($request, $service);

        $service->update($validated);

        $this->log('updated', "Updated service \"{$service->name}\"", 'service', $service);

        return redirect()->back()->with('success', "Service \"{$service->name}\" updated.");
    }

    public function toggle(Request $request, Service $service): RedirectResponse
    {
        $this->requireSuperAdmin($request);

        $service->update(['is_active' => ! $service->is_active]);

        $state = $service->is_active ? 'activated' : 'deactivated';

        $this->log($state, "Service \"{$service->name}\" {$state}", 'service', $service);

        return redirect()->back()->with('success', "Service \"{$service->name}\" {$state}.");
    }

    public function destroy(Request $request, Service $service): RedirectResponse
    {
        $this->requireSuperAdmin($request);

        $name = $service->name;
        $service->delete();

        $this->log('deleted', "Deleted service \"{$name}\"", 'service');

        return redirect()->back()->with('success', "Service \"{$name}\" deleted.");
    }

    private function requireSuperAdmin(Request $request): void
    {
        if (! $request->user()?->isSuperAdmin()) {
            abort(403, 'Super admin access required.');
        }
    }

    private function validateService(Request $request, ?Service $service = null): array
    {
        $validated = $request->validate([
            'key' => ['required', 'string', 'max:100',
                Rule::unique('services', 'key')->ignore($service?->id)],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'web_path' => ['nullable', 'string', 'max:255'],
            'api_base_path' => ['nullable', 'string', 'max:255'],
            'usage_notes' => ['nullable', 'string', 'max:10000'],
            'is_active' => ['boolean'],
            'api_endpoints' => ['nullable', 'array'],
            'api_endpoints.*.method' => ['required_with:api_endpoints', 'string', 'max:10'],
            'api_endpoints.*.path' => ['required_with:api_endpoints', 'string', 'max:255'],
            'api_endpoints.*.description' => ['nullable', 'string', 'max:500'],
            'api_endpoints.*.auth' => ['nullable', 'string', 'max:50'],
        ]);

        $validated['api_endpoints'] = $validated['api_endpoints'] ?? [];

        return $validated;
    }

    private function serviceResource(Service $service): array
    {
        return [
            'id' => $service->id,
            'key' => $service->key,
            'name' => $service->name,
            'description' => $service->description,
            'web_path' => $service->web_path,
            'api_base_path' => $service->api_base_path,
            'api_endpoints' => $service->api_endpoints ?? [],
            'usage_notes' => $service->usage_notes,
            'is_active' => $service->is_active,
            'endpoint_count' => count($service->api_endpoints ?? []),
            'created_at' => $service->created_at->toIso8601String(),
            'created_ago' => $service->created_at->diffForHumans(),
            'updated_ago' => $service->updated_at->diffForHumans(),
        ];
    }

    public function summary(): array
    {
        return [
            'total' => Service::count(),
            'active' => Service::where('is_active', true)->count(),
            'inactive' => Service::where('is_active', false)->count(),
        ];
    }

    public function translator(): Response
    {
        return $this->serviceDetails('translator');
    }

    public function serviceDetails(string $key)
    {
        $service = Service::where('key', $key)->firstOrFail();

        if ($service->key === 'translator') {
            $usageStats = 10;

            return Inertia::render('translator', [
                'service' => $this->serviceResource($service),
                'usageStats' => $usageStats,
            ]);
        } elseif ($service->key === 'encryption') {
            return Inertia::render('encryption', [
                'service' => $this->serviceResource($service),
            ]);
        } elseif ($service->key === 'vault') {
            return Inertia::render('vault/vault', [
                'service' => $this->serviceResource($service),
            ]);
        } elseif ($service->key === 'drive') {
            return Inertia::render('drive/drive', [
                'service' => $this->serviceResource($service),
            ]);
        } elseif ($service->key === 'meet') {
            return redirect()->route('meet.index');
        } else {
            return Inertia::render('service-details', [
                'service' => $this->serviceResource($service),
            ]);
        }
    }
}
