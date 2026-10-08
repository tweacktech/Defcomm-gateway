<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\OrganizationServiceKey;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use RuntimeException;

class OrganizationServiceKeyService
{
    public function create(Organization $organization, Service $service, string $name, ?User $creator = null): array
    {
        if (! $service->is_active) {
            throw new RuntimeException('Service is inactive.');
        }

        $plain = 'sdsk_'.Str::random(40);

        $record = OrganizationServiceKey::create([
            'organization_id' => $organization->id,
            'service_id' => $service->id,
            'created_by' => $creator?->id,
            'name' => $name,
            'key_prefix' => substr($plain, 0, 12),
            'key_lookup' => hash('sha256', $plain),
            'is_active' => true,
        ]);

        return [
            'key' => $record->load('service:id,key,name'),
            'plain_key' => $plain,
        ];
    }

    public function findByPlainKey(string $plain): ?OrganizationServiceKey
    {
        $plain = trim($plain);
        if ($plain === '') {
            return null;
        }

        $record = OrganizationServiceKey::query()
            ->with(['service', 'organization'])
            ->where('key_lookup', hash('sha256', $plain))
            ->where('is_active', true)
            ->whereNull('revoked_at')
            ->first();

        if ($record) {
            $record->forceFill(['last_used_at' => now()])->save();
        }

        return $record;
    }

    public function listForOrganization(Organization $organization): Collection
    {
        return OrganizationServiceKey::query()
            ->with('service:id,key,name')
            ->where('organization_id', $organization->id)
            ->whereNull('revoked_at')
            ->latest()
            ->get()
            ->map(fn (OrganizationServiceKey $key) => [
                'uuid' => $key->uuid,
                'name' => $key->name,
                'key_prefix' => $key->key_prefix,
                'service_key' => $key->service?->key,
                'service_name' => $key->service?->name,
                'is_active' => $key->is_active,
                'last_used_at' => $key->last_used_at?->toIso8601String(),
                'created_at' => $key->created_at?->toIso8601String(),
            ]);
    }

    public function revoke(Organization $organization, OrganizationServiceKey $key): void
    {
        if ((int) $key->organization_id !== (int) $organization->id) {
            abort(404);
        }

        $key->update([
            'is_active' => false,
            'revoked_at' => now(),
        ]);
    }
}
