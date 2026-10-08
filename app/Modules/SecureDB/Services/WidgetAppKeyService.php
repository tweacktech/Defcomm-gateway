<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbWidget;
use App\Modules\SecureDB\Models\SecureDbWidgetAppKey;
use Illuminate\Support\Str;

class WidgetAppKeyService
{
    public function create(SecureDbWidget $widget, string $name): array
    {
        $plain = 'sdbk_'.Str::random(40);

        $record = SecureDbWidgetAppKey::create([
            'widget_id' => $widget->id,
            'project_id' => $widget->project_id,
            'name' => $name,
            'key_prefix' => substr($plain, 0, 12),
            'key_lookup' => hash('sha256', $plain),
            'is_active' => true,
        ]);

        return [
            'key' => $record,
            'plain_key' => $plain,
        ];
    }

    public function findByPlainKey(string $plain): ?SecureDbWidgetAppKey
    {
        $plain = trim($plain);
        if ($plain === '') {
            return null;
        }

        $record = SecureDbWidgetAppKey::query()
            ->where('key_lookup', hash('sha256', $plain))
            ->where('is_active', true)
            ->whereNull('revoked_at')
            ->first();

        if ($record) {
            $record->forceFill(['last_used_at' => now()])->save();
        }

        return $record;
    }

    public function listForWidget(SecureDbWidget $widget)
    {
        return SecureDbWidgetAppKey::query()
            ->where('widget_id', $widget->id)
            ->whereNull('revoked_at')
            ->latest()
            ->get(['uuid', 'name', 'key_prefix', 'is_active', 'last_used_at', 'created_at'])
            ->map(fn (SecureDbWidgetAppKey $key) => [
                'uuid' => $key->uuid,
                'name' => $key->name,
                'key_prefix' => $key->key_prefix,
                'is_active' => $key->is_active,
                'last_used_at' => $key->last_used_at?->toIso8601String(),
                'created_at' => $key->created_at?->toIso8601String(),
            ])
            ->values();
    }

    public function revoke(SecureDbWidget $widget, SecureDbWidgetAppKey $key): void
    {
        if ($key->widget_id !== $widget->id) {
            abort(404);
        }

        $key->update([
            'is_active' => false,
            'revoked_at' => now(),
        ]);
    }
}
