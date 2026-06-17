# Secure DB Module — Developer Documentation

## Architecture

The Secure DB module lives under `app/Modules/SecureDB/` and follows Laravel service-oriented architecture:

```
app/Modules/SecureDB/
├── Concerns/HasUuid.php
├── Enums/
├── Http/Controllers/Admin/SecureDbAdminController.php
├── Http/Controllers/Api/SecureDbApiController.php
├── Jobs/
├── Middleware/
├── Models/
├── Policies/
├── Providers/SecureDbServiceProvider.php
└── Services/
```

## Key Services

| Service | Purpose |
|---------|---------|
| `EncryptionService` | AES-256-GCM, ChaCha20-Poly1305, RSA hybrid encryption |
| `KeyManagementService` | Envelope encryption, key rotation, revocation |
| `ConnectionService` | Encrypted credential storage, health checks |
| `DecryptionService` | Permission/device/session validated decryption |
| `AuditService` | Immutable audit trail with export |
| `PermissionService` | RBAC per project |
| `WebhookService` | Event delivery with retry queue |
| `NotificationService` | Email, SMS, in-app alerts |
| `MonitoringService` | CPU, memory, queue, DB health |
| `ReportService` | Compliance and activity reports |

## Database Tables

All tables use UUIDs, soft deletes (where applicable), foreign keys, and audit fields.

## Queue Jobs

- `EncryptDatabaseJob` — batch field encryption
- `RotateKeysJob` — key rotation with rollback
- `HealthCheckJob` — connection monitoring
- `IntegrityCheckJob` — encrypted data validation
- `DeviceMonitoringJob` — stale device revocation
- `WebhookDeliveryJob` — webhook retry delivery

## Scheduler

Configured in `routes/console.php`:
- Health checks every 5 minutes
- Device monitoring hourly
- Key rotation per project interval

## Registration

- Service provider: `bootstrap/providers.php`
- Web routes: `routes/secure-db.php` (included from `routes/web.php`)
- API routes: `routes/api.php` prefix `/api/secure-db`

## Running Migrations

```bash
php artisan migrate
php artisan db:seed --class=SecureDbSeeder
```

## Running Tests

```bash
php artisan test --filter=SecureDB
```
