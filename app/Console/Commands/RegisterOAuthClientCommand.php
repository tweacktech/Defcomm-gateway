<?php

namespace App\Console\Commands;

use App\Models\OAuthClient;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class RegisterOAuthClientCommand extends Command
{
    protected $signature = 'oauth:register-client
                            {name : Display name for the external project}
                            {redirect_uri : OAuth callback URL}
                            {--scope=read : Default scopes (space-separated)}
                            {--secret= : Client secret (generated if omitted)}';

    protected $description = 'Register an external project as an OAuth2 client for centralized authentication';

    public function handle(): int
    {
        $name = $this->argument('name');
        $redirectUri = $this->argument('redirect_uri');
        $scope = $this->option('scope') ?? 'read';
        $plainSecret = $this->option('secret') ?: Str::random(40);

        $client = OAuthClient::create([
            'name' => $name,
            'secret' => hash('sha256', $plainSecret),
            'redirect_uris' => [$redirectUri],
            'scope' => $scope,
            'is_active' => true,
        ]);

        $baseUrl = rtrim(config('app.url'), '/');

        $this->newLine();
        $this->info('OAuth2 client registered successfully.');
        $this->table(
            ['Key', 'Value'],
            [
                ['Client ID', (string) $client->id],
                ['Client Secret', $plainSecret],
                ['Redirect URI', $redirectUri],
                ['Scopes', $scope],
            ]
        );

        $this->newLine();
        $this->line('Send users to authorize:');
        $this->line("  {$baseUrl}/auth/authorize?client_id={$client->id}&redirect_uri=".urlencode($redirectUri)."&scope=".urlencode($scope).'&state=RANDOM_STATE');
        $this->newLine();
        $this->line('Exchange code for token:');
        $this->line("  POST {$baseUrl}/auth/token");

        return self::SUCCESS;
    }
}
