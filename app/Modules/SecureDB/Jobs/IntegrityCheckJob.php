<?php

namespace App\Modules\SecureDB\Jobs;

use App\Modules\SecureDB\Models\SecureDbEncryptedMetadata;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Services\EncryptionService;
use App\Modules\SecureDB\Services\KeyManagementService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class IntegrityCheckJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public SecureDbProject $project) {}

    public function handle(EncryptionService $encryption, KeyManagementService $kms): void
    {
        $key = $this->project->activeKey();
        if (! $key) {
            return;
        }

        $dek = $kms->getDecryptedKey($key);
        $failed = 0;
        $checked = 0;

        SecureDbEncryptedMetadata::where('project_id', $this->project->id)
            ->limit(100)
            ->each(function ($meta) use ($encryption, $dek, &$failed, &$checked) {
                $checked++;
                try {
                    if (! empty($meta->metadata['sample_encrypted'] ?? null)) {
                        $encryption->decryptField($meta->metadata['sample_encrypted'], $dek, $meta->algorithm);
                    }
                } catch (\Throwable) {
                    $failed++;
                }
            });
    }
}
