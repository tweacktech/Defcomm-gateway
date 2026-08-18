<?php

namespace App\Modules\SecureDB\Services;

use App\Models\User;
use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbNotification;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Models\SecureDbSetting;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    public function notify(
        string $type,
        string $title,
        string $message,
        ?SecureDbProject $project = null,
        ?User $user = null,
        array $channels = ['in_app'],
        array $metadata = [],
    ): void {
        foreach ($channels as $channel) {
            $notification = SecureDbNotification::create([
                'project_id' => $project?->id,
                'user_id' => $user?->id,
                'channel' => $channel,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'metadata' => $metadata,
                'sent_at' => now(),
            ]);

            match ($channel) {
                'email' => $this->sendEmail($user, $title, $message),
                'sms' => $this->sendSms($user, $message),
                default => null,
            };
        }
    }

    public function alertFailedDecryption(SecureDbProject $project, ?User $user, string $reason): void
    {
        $channels = SecureDbSetting::getValue('notification_channels', ['in_app', 'email']);
        $this->notify('failed_decryption', 'Decryption Failed', $reason, $project, $user, $channels);
    }

    public function alertUnauthorizedAccess(SecureDbProject $project, string $details): void
    {
        $channels = SecureDbSetting::getValue('notification_channels', ['in_app', 'email']);
        $this->notify('unauthorized_access', 'Unauthorized Access', $details, $project, null, $channels);
    }

    public function alertConnectionFailure(SecureDbProject $project, string $connectionName): void
    {
        $channels = SecureDbSetting::getValue('notification_channels', ['in_app']);
        $this->notify('connection_failure', 'Connection Failure', "Connection {$connectionName} is unhealthy.", $project, null, $channels);
    }

    public function alertRotationFailure(SecureDbProject $project, string $error): void
    {
        $channels = SecureDbSetting::getValue('notification_channels', ['in_app', 'email']);
        $this->notify('rotation_failure', 'Key Rotation Failed', $error, $project, null, $channels);
    }

    public function alertEncryptionCompleted(
        SecureDbConnection $connection,
        ?User $user,
        string $scope,
        array $result,
    ): void {
        $title = 'Database Encryption Completed';
        $message = sprintf(
            "Encryption finished for connection \"%s\" (%s scope).\n\nProcessed: %d value(s)\nTables: %d\nAlgorithm: %s\nFields: %s",
            $connection->name,
            $scope,
            $result['processed'] ?? 0,
            $result['tables'] ?? 0,
            $result['algorithm'] ?? 'n/a',
            implode(', ', $result['fields'] ?? []) ?: '—',
        );

        $channels = SecureDbSetting::getValue('notification_channels', ['in_app', 'email']);
        $this->notify('encryption_completed', $title, $message, $connection->project, $user, $channels, $result);
    }

    public function alertEncryptionFailed(
        SecureDbConnection $connection,
        ?User $user,
        string $scope,
        string $error,
    ): void {
        $title = 'Database Encryption Failed';
        $message = sprintf(
            "Encryption failed for connection \"%s\" (%s scope).\n\nError: %s",
            $connection->name,
            $scope,
            $error,
        );

        $channels = SecureDbSetting::getValue('notification_channels', ['in_app', 'email']);
        $this->notify('encryption_failed', $title, $message, $connection->project, $user, $channels);
    }

    protected function sendEmail(?User $user, string $title, string $message): void
    {
        if (! $user?->email) {
            return;
        }

        Mail::raw($message, fn ($mail) => $mail->to($user->email)->subject($title));
    }

    protected function sendSms(?User $user, string $message): void
    {
        // SMS integration point — logs for audit when no provider configured
        logger()->info('SecureDB SMS notification', ['user_id' => $user?->id, 'message' => $message]);
    }
}
