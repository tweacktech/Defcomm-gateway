<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbEncryptionPolicy;

class EncryptionFieldService
{
    public function forTable(SecureDbConnection $connection, string $tableOrCollection): array
    {
        $policies = SecureDbEncryptionPolicy::where('connection_id', $connection->id)
            ->where('is_active', true)
            ->where(function ($q) use ($tableOrCollection) {
                $q->where('target_table', $tableOrCollection)
                    ->orWhere('target_collection', $tableOrCollection);
            })
            ->get();

        $encryptedFields = [];
        $algorithms = [];
        foreach ($policies as $policy) {
            foreach ($policy->sensitive_fields ?? [] as $field) {
                $encryptedFields[] = $field;
                $algorithms[$field] = $policy->algorithm;
            }
        }

        $project = $connection->project;
        $lastRotation = $project?->last_rotation_at?->toIso8601String();

        return [
            'encrypted_fields' => array_values(array_unique($encryptedFields)),
            'field_algorithms' => $algorithms,
            'last_rotation' => $lastRotation,
            'has_encryption' => count($encryptedFields) > 0,
        ];
    }

    public function annotateRow(array $row, array $encryptionMeta): array
    {
        $annotated = [];
        foreach ($row as $key => $value) {
            $isEncrypted = in_array($key, $encryptionMeta['encrypted_fields'] ?? [], true);
            $annotated[$key] = [
                'value' => $value,
                'encrypted' => $isEncrypted,
                'algorithm' => $isEncrypted ? ($encryptionMeta['field_algorithms'][$key] ?? null) : null,
            ];
        }

        return $annotated;
    }
}
