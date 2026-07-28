# Wiring this into your app

These 3 things live in files you already have, so they're written here as diffs
rather than full files I'd otherwise overwrite blindly.

## 1. Register the middleware alias

**bootstrap/app.php** (Laravel 11+):

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'api.token' => \App\Http\Middleware\ApiTokenAuth::class,
    ]);
})
```

(Laravel 10 and earlier: add the same line to `$routeMiddleware` in `app/Http/Kernel.php`.)

## 2. Register the User observer

**app/Providers/AppServiceProvider.php**, inside `boot()`:

```php
use App\Models\User;
use App\Observers\UserObserver;

public function boot(): void
{
    User::observe(UserObserver::class);
}
```

## 3. Include the new route file

**routes/web.php** (or wherever your existing `auth/*` routes are currently
defined — merge these into that file, or just require it):

```php
require __DIR__ . '/auth-sync.php';
```

## 4. Run the new migration

```bash
php artisan migrate
```

## 5. One-time data note

`OAuthClient::hasRedirectUri()` expects `redirect_uris` to be a JSON array,
e.g. `["https://partner.example.com/callback"]`. If your existing
`oauth_clients` rows were seeded with a comma-separated string, convert them:

```php
DB::table('oauth_clients')->get()->each(function ($client) {
    if (!str_starts_with(trim($client->redirect_uris), '[')) {
        DB::table('oauth_clients')->where('id', $client->id)->update([
            'redirect_uris' => json_encode(array_map('trim', explode(',', $client->redirect_uris))),
        ]);
    }
});
```
