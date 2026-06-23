<?php

namespace App\Modules\SecureDB\Providers;

use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Policies\SecureDbProjectPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class SecureDbServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::policy(SecureDbProject::class, SecureDbProjectPolicy::class);
    }
}
