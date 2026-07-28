# Setup & Deployment Guide

## Prerequisites

- Laravel 11+ with database support
- PHP 8.2+
- Redis (optional, for token management)
- Git

## Installation Steps

### Step 1: Pull Latest Code

```bash
cd /Users/user/Project/Silex/defcomm-gateway
git pull origin main
```

### Step 2: Install Dependencies

```bash
composer install
npm install
```

### Step 3: Run Migrations

Execute the three new migrations:

```bash
php artisan migrate

# You should see:
# Migrating: 2026_07_16_000001_create_access_logs_table
# Migrated: 2026_07_16_000001_create_access_logs_table (0.15s)
# Migrating: 2026_07_16_000002_create_oauth_tables
# Migrated: 2026_07_16_000002_create_oauth_tables (0.21s)
# Migrating: 2026_07_16_000003_create_api_tokens_table
# Migrated: 2026_07_16_000003_create_api_tokens_table (0.18s)
```

### Step 4: Register OAuth2 Clients

If you have external services to integrate, register them as OAuth2 clients:

```bash
php artisan tinker
```

```php
DB::table('oauth_clients')->insert([
    'name' => 'Mobile App',
    'secret' => hash('sha256', 'mobile_app_secret_key'),
    'redirect_uris' => 'https://mobileapp.defcomm.ng/auth/callback',
    'scope' => 'read write',
    'is_active' => true,
    'created_at' => now(),
    'updated_at' => now(),
]);

// Get the client ID
$client = DB::table('oauth_clients')->where('name', 'Mobile App')->first();
echo $client->id;  // This is your client_id
```

### Step 5: Update Environment Variables (if needed)

Add to `.env`:

```env
# OAuth2 Configuration (optional - customize as needed)
OAUTH_TOKEN_EXPIRY_HOURS=1
OAUTH_REFRESH_TOKEN_EXPIRY_DAYS=30
OAUTH_AUTH_CODE_EXPIRY_MINUTES=10

# API Token Configuration (optional)
API_TOKEN_HASH_ALGORITHM=sha256
```

### Step 6: Build Frontend (if needed)

```bash
npm run build
```

### Step 7: Verify Installation

```bash
# Check that tables were created
php artisan db:table access_logs
php artisan db:table oauth_clients
php artisan db:table oauth_access_tokens
php artisan db:table api_tokens
```

---

## Configuration

### OAuth2 Settings

The OAuth2 implementation is configured in these files:

1. **`app/Services/Auth/CentralizedAuthService.php`** - Core OAuth2 logic
   - Token expiration times
   - Authorization code lifetime
   - Token hashing algorithm

2. **`app/Http/Controllers/Auth/CentralizedAuthController.php`** - OAuth2 endpoints

To customize token expiration times:

```php
// In CentralizedAuthService.php

// Change this line:
$expiresIn = 3600; // 1 hour in seconds

// Change this:
'expires_at' => now()->addDays(30), // For refresh tokens

// Change this:
'expires_at' => now()->addMinutes(10), // For auth codes
```

### API Token Settings

To customize API token behavior:

```php
// In app/Models/ApiToken.php

// Modify the create() method default expiration:
public static function create(
    User $user,
    string $name,
    array $scopes = [],
    ?int $expiresInDays = 365  // ← Change this
): self
```

---

## Middleware Registration

To use API token authentication in your routes, register the middleware in `app/Http/Kernel.php`:

```php
protected $routeMiddleware = [
    // ... existing middleware
    'auth:api.token' => \App\Http\Middleware\ApiTokenAuth::class,
];
```

Then use in routes:

```php
Route::middleware(['auth:api.token'])->group(function () {
    Route::get('/protected-resource', function (Request $request) {
        // $request->user() contains authenticated user
        // $request->get('api_token') contains token info
    });
});
```

---

## Testing the System

### Test File Analytics

1. **Create a shared file:**
   ```
   1. Go to /services/drive
   2. Create a folder or upload a file
   3. Right-click → Share
   4. Create a public link
   ```

2. **View analytics:**
   ```
   1. Click the analytics button or navigate to /drive/shares/{shareId}/analytics
   2. You should see statistics
   ```

### Test API Token

```bash
# 1. Get your user token from the dashboard or API

# 2. Create an API token
curl -X POST http://localhost:8000/api/central-auth/api-tokens \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token",
    "scopes": ["read"],
    "expires_in_days": 1
  }'

# 3. Copy the token from response

# 4. Verify the token
curl http://localhost:8000/api/central-auth/verify-token \
  -H "Authorization: Bearer token_xxxx..."
```

### Test OAuth2

```bash
# 1. Get your OAuth2 credentials from admin

# 2. Start flow by opening in browser:
http://localhost:8000/auth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/callback&scope=read%20write&state=abc123

# 3. You should see login form
# 4. After login, you should see approval screen
# 5. After approval, you'll be redirected to callback URL with authorization code

# 6. Exchange code for token (from your backend):
curl -X POST http://localhost:8000/api/central-auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "CODE_FROM_REDIRECT",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uri": "http://localhost:3000/callback"
  }'

# 7. You should receive access_token and refresh_token
```

---

## Database Cleanup

### Remove Expired Tokens (Optional)

Create a scheduled job to clean up expired tokens:

```php
// app/Console/Commands/CleanupExpiredTokens.php

php artisan make:command CleanupExpiredTokens
```

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupExpiredTokens extends Command
{
    protected $signature = 'auth:cleanup-tokens';
    protected $description = 'Remove expired OAuth and API tokens';

    public function handle()
    {
        $deletedOAuth = DB::table('oauth_access_tokens')
            ->where('expires_at', '<', now())
            ->delete();

        $deletedApi = DB::table('api_tokens')
            ->where('expires_at', '<', now())
            ->delete();

        $this->info("Deleted {$deletedOAuth} expired OAuth tokens");
        $this->info("Deleted {$deletedApi} expired API tokens");
    }
}
```

Add to scheduler in `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule)
{
    $schedule->command('auth:cleanup-tokens')
        ->daily()
        ->at('02:00');  // Run at 2 AM daily
}
```

---

## Security Checklist

- [ ] All tokens are stored hashed in database
- [ ] OAuth2 client secrets are hashed before storage
- [ ] HTTPS is enabled in production
- [ ] CORS is properly configured for cross-origin requests
- [ ] Rate limiting is enabled on auth endpoints
- [ ] API tokens have appropriate scopes
- [ ] Token expiration is set to reasonable values
- [ ] Old tokens are regularly cleaned up
- [ ] Audit logging is enabled for auth events
- [ ] Refresh tokens are rotated on use (optional)

---

## Monitoring & Maintenance

### Daily Tasks

```bash
# Clean up expired tokens
php artisan auth:cleanup-tokens

# Monitor failed auth attempts (if logging is enabled)
tail -f storage/logs/laravel.log | grep "auth"
```

### Weekly Tasks

```bash
# Review active OAuth2 clients
php artisan tinker
DB::table('oauth_clients')->where('is_active', true)->get();

# Review frequently used API tokens
DB::table('api_tokens')
    ->where('is_active', true)
    ->orderByDesc('last_used_at')
    ->limit(10)
    ->get();
```

### Monthly Tasks

- Review for unused tokens
- Rotate client secrets if needed
- Update documentation if endpoints change
- Test OAuth2 and API token flows

---

## Troubleshooting

### Issue: Migrations won't run

**Error:** `SQLSTATE[HY000]: General error`

**Solution:** 
```bash
# Check database connection
php artisan tinker
DB::connection()->getPdo();

# If using SQLite, ensure database file has write permissions
chmod 666 database/database.sqlite
chmod 755 database/
```

### Issue: Tokens not working after deployment

**Solution:**
```bash
# Clear application cache
php artisan cache:clear

# Rebuild configuration
php artisan config:cache

# Restart queue workers if using queues
php artisan queue:restart
```

### Issue: OAuth2 redirect not working

**Solution:**
- Verify `redirect_uri` matches exactly (including trailing slash)
- Check that callback domain is whitelisted
- Ensure cookies are enabled in browser

---

## Integration with External Services

### Defcomm User API

Your centralized auth can be integrated with the existing `USER_API` (https://backend.defcomm.ng/api):

```php
// In your service that uses external API

use App\Services\Auth\CentralizedAuthService;

// Get access token from centralized auth
$token = $request->bearerToken();
$user = CentralizedAuthService::validateAccessToken($token);

// Use token to call external API
$response = Http::withToken($token)
    ->get('https://backend.defcomm.ng/api/users/'.$user->id);
```

### Database Sync

Keep user data in sync between systems:

```php
// After successful OAuth2 token generation
Event::dispatch(new UserAuthenticatedViaOAuth2($user));

// In listener: sync user data with USER_API if needed
```

---

## Performance Optimization

### Index Database Queries

Already indexed in migrations:
- `access_logs.drive_share_id`
- `access_logs.created_at`
- `oauth_access_tokens.token`
- `oauth_access_tokens.expires_at`
- `api_tokens.token`
- `api_tokens.user_id`

### Cache Token Lookups (Optional)

```php
// In CentralizedAuthService.php

public static function validateAccessToken(string $token): ?User
{
    return Cache::remember("oauth_token:{$token}", now()->addHour(), function () use ($token) {
        $accessToken = DB::table('oauth_access_tokens')
            ->where('token', hash('sha256', $token))
            ->where('expires_at', '>', now())
            ->first();

        return $accessToken ? User::find($accessToken->user_id) : null;
    });
}
```

---

## Documentation

- **Full OAuth2 & API Token Guide:** `docs/CENTRALIZED_AUTH.md`
- **Quick Reference:** `QUICK_REFERENCE.md`
- **Implementation Summary:** `IMPLEMENTATION_SUMMARY.md`
- **This file:** `SETUP_DEPLOYMENT.md`

---

## Support & Escalation

For issues:
1. Check the troubleshooting section above
2. Review logs: `storage/logs/laravel.log`
3. Check database for token records
4. Verify middleware registration
5. Test with curl/Postman before debugging integration

---

**Last Updated:** July 16, 2026
**Version:** 1.0
