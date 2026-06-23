# Secure DB — Installation Guide

## Prerequisites

- PHP 8.2+
- Laravel 12
- Redis (recommended for queues)
- OpenSSL with AES-256-GCM and ChaCha20-Poly1305 support

## Installation Steps

### 1. Run Migrations

```bash
php artisan migrate
```

This creates all `secure_db_*` tables.

### 2. Seed Roles and Settings

```bash
php artisan db:seed --class=SecureDbSeeder
```

Creates RBAC roles (Super Admin, Organization Admin, Security Officer, Developer, Viewer) and default settings.

### 3. Configure Queue

Set in `.env`:

```
QUEUE_CONNECTION=redis
```

Start the queue worker:

```bash
php artisan queue:work
```

### 4. Configure Scheduler

Add to crontab:

```
* * * * * cd /path/to/project && php artisan schedule:run >> /dev/null 2>&1
```

### 5. Build Frontend

```bash
npm run build
```

### 6. Verify Installation

1. Log in as an admin user
2. Navigate to Security → Secure DB
3. Create a test project
4. Test API with generated credentials:

```bash
curl -X POST https://your-domain/api/secure-db/encrypt \
  -H "X-Secure-DB-Key: YOUR_API_KEY" \
  -H "X-Secure-DB-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"value":"test data"}'
```

## Optional: MongoDB / Redis Connections

- **MongoDB**: Install `mongodb/mongodb` PHP library or ext-mongodb
- **Redis**: Install `ext-redis` or `predis/predis`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 403 on admin pages | Ensure user has `role = admin` |
| Connection test fails | Verify firewall, credentials, SSL settings |
| Queue jobs not running | Check `queue:work` is active and Redis is reachable |
| Rotation not scheduled | Verify `schedule:run` cron is configured |
