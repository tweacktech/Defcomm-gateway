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

## 4. Run the new migrations

```bash
php artisan migrate
```

This includes `allow_interactive_login` on `api_tokens` and the new
`magic_link_tokens` table.

## 5. Mail configuration

`MagicLinkMail` uses your app's default mailer (`MAIL_MAILER` in `.env`) and
implements `ShouldQueue`, so a queue worker must be running
(`php artisan queue:work`) or emails won't send. Point `resources/views/emails/magic-link.blade.php`
at your own branding as needed.

## 6. Embed the alternate login options

`resources/js/components/auth/alternate-login-options.tsx` is self-contained
— drop `<AlternateLoginOptions />` into your existing login page, e.g. below
the password form or as a tab. It assumes shadcn's `Tabs`, `Input`, and
`Label` primitives exist under `@/components/ui/*` (same family as the
`Card`/`Button`/`Badge` already used in `Welcome.tsx`) — add any of those via
`npx shadcn add tabs input label` if missing.

## 7. Enabling a token for sign-in

Regular API tokens created via `POST /auth/api-tokens` cannot log in
interactively by default. To mint one that can, pass
`"allow_interactive_login": true` in that same request. Consider exposing
this as an explicit, clearly-labeled checkbox in your token-creation UI
("Allow this token to sign in to the dashboard") rather than a hidden default,
since it changes the blast radius of that token if leaked.

## 8. One-time data note

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
