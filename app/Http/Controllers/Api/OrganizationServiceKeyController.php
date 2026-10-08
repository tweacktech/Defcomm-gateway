<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\OrganizationServiceKey;
use App\Models\Service;
use App\Services\OrganizationServiceKeyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrganizationServiceKeyController extends Controller
{
    public function __construct(
        protected OrganizationServiceKeyService $keys,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $organization = $this->organization($request);

        return response()->json([
            'data' => $this->keys->listForOrganization($organization),
            'services' => Service::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'key', 'name', 'description', 'api_base_path']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $organization = $this->organization($request);
        $data = $request->validate([
            'service_key' => 'required|string|exists:services,key',
            'name' => 'required|string|max:120',
        ]);

        $service = Service::query()->where('key', $data['service_key'])->where('is_active', true)->firstOrFail();
        $result = $this->keys->create($organization, $service, $data['name'], $request->user());

        return response()->json([
            'message' => 'Save this service key now. It will not be shown again.',
            'plain_key' => $result['plain_key'],
            'data' => [
                'uuid' => $result['key']->uuid,
                'name' => $result['key']->name,
                'key_prefix' => $result['key']->key_prefix,
                'service_key' => $service->key,
                'service_name' => $service->name,
                'created_at' => $result['key']->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function destroy(Request $request, OrganizationServiceKey $serviceKey): JsonResponse
    {
        $organization = $this->organization($request);
        $this->keys->revoke($organization, $serviceKey);

        return response()->json(['message' => 'Service key revoked.']);
    }

    protected function organization(Request $request): Organization
    {
        $user = $request->user();
        abort_unless($user, 401);

        if (! $user->isSuperAdmin() && ! $user->isCompanyAdmin()) {
            abort(403, 'Only company admins can manage service keys.');
        }

        $organization = $request->attributes->get('organization');
        if ($organization instanceof Organization) {
            return $organization;
        }

        $organization = Organization::query()->find($user->organization_id);
        abort_unless($organization, 422, 'User has no organization.');

        return $organization;
    }
}
