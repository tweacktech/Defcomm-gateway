<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use App\Models\Service;
use App\Services\OrganizationServiceKeyService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureServiceKey
{
    public function __construct(
        protected OrganizationServiceKeyService $keys,
    ) {}

    /**
     * Validate X-Service-Key for a specific services.key catalog entry.
     *
     * Usage: middleware('service.key:chat')
     */
    public function handle(Request $request, Closure $next, string $serviceKey): Response
    {
        $plain = $request->header('X-Service-Key')
            ?? $request->input('service_key');

        if (! $plain) {
            return response()->json([
                'message' => 'Service API key required. Send X-Service-Key for this service.',
            ], 401);
        }

        $record = $this->keys->findByPlainKey($plain);
        if (! $record || ! $record->isUsable()) {
            return response()->json([
                'message' => 'Invalid or revoked service API key.',
            ], 401);
        }

        $service = $record->service;
        if (! $service || ! $service->is_active || $service->key !== $serviceKey) {
            return response()->json([
                'message' => "This service key is not valid for '{$serviceKey}'.",
            ], 403);
        }

        /** @var Organization|null $organization */
        $organization = $request->attributes->get('organization');
        if ($organization && (int) $organization->id !== (int) $record->organization_id) {
            return response()->json([
                'message' => 'Service key does not belong to this organization.',
            ], 403);
        }

        if (! $organization) {
            $organization = $record->organization;
            if (! $organization || $organization->status !== 'active') {
                return response()->json([
                    'message' => 'Organization for this service key is inactive.',
                ], 403);
            }
            $request->attributes->set('organization', $organization);
        }

        $catalog = Service::query()->where('key', $serviceKey)->where('is_active', true)->first();
        if (! $catalog) {
            return response()->json([
                'message' => 'Service is inactive or not found.',
            ], 403);
        }

        $request->attributes->set('organization_service_key', $record);
        $request->attributes->set('gateway_service', $service);

        return $next($request);
    }
}
