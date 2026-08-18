<?php

namespace App\Modules\SecureDB\Services;

use App\Modules\SecureDB\Models\SecureDbConnection;
use App\Modules\SecureDB\Models\SecureDbProject;
use App\Modules\SecureDB\Models\SecureDbWidget;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class WidgetService
{
    public const LANGUAGES = [
        'javascript' => 'JavaScript / HTML',
        'php' => 'PHP',
        'python' => 'Python',
        'react' => 'React',
        'vue' => 'Vue.js',
        'laravel' => 'Laravel (Blade)',
        'dotnet' => '.NET / C#',
        'java' => 'Java',
    ];

    public const DATABASE_MARKET = [
        'mysql' => ['label' => 'MySQL', 'port' => 3306, 'icon' => 'mysql'],
        'mariadb' => ['label' => 'MariaDB', 'port' => 3306, 'icon' => 'mariadb'],
        'postgresql' => ['label' => 'PostgreSQL', 'port' => 5432, 'icon' => 'postgresql'],
        'sqlserver' => ['label' => 'SQL Server', 'port' => 1433, 'icon' => 'sqlserver'],
        'mongodb' => ['label' => 'MongoDB', 'port' => 27017, 'icon' => 'mongodb'],
        'redis' => ['label' => 'Redis', 'port' => 6379, 'icon' => 'redis'],
    ];

    public static function databaseTypes(): array
    {
        return collect(self::DATABASE_MARKET)->mapWithKeys(fn ($m, $k) => [$k => $m['label']])->all();
    }

    public function generateCredentials(): array
    {
        return [
            'widget_key' => 'wdg_' . Str::random(32),
            'secret_key' => 'wsec_' . Str::random(48),
        ];
    }

    public function create(
        SecureDbProject $project,
        string $name,
        string $language,
        string $databaseType,
        int $createdBy,
        ?array $allowedOrigins = null,
    ): array {
        if (! array_key_exists($databaseType, self::DATABASE_MARKET)) {
            throw new \InvalidArgumentException("Unsupported database type: {$databaseType}");
        }

        $creds = $this->generateCredentials();

        $widget = SecureDbWidget::create([
            'project_id' => $project->id,
            'connection_id' => null,
            'created_by' => $createdBy,
            'name' => $name,
            'widget_key' => $creds['widget_key'],
            'secret_key_hash' => Hash::make($creds['secret_key']),
            'language' => $language,
            'database_type' => $databaseType,
            'allowed_origins' => $allowedOrigins,
            'is_active' => true,
        ]);

        return [
            'widget' => $widget->load('project'),
            'secret_key' => $creds['secret_key'],
            'embed_code' => $this->buildEmbedCode($widget, $creds['secret_key']),
        ];
    }

    public function regenerateSecret(SecureDbWidget $widget): array
    {
        $secret = 'wsec_' . Str::random(48);
        $widget->update(['secret_key_hash' => Hash::make($secret)]);

        return [
            'secret_key' => $secret,
            'embed_code' => $this->buildEmbedCode($widget, $secret),
        ];
    }

    public function buildEmbedCode(SecureDbWidget $widget, ?string $secret = null): array
    {
        $baseUrl = rtrim(config('app.url'), '/');
        $widgetKey = $widget->widget_key;
        $lang = $widget->language;

        $scriptTag = <<<HTML
<script src="{$baseUrl}/secure-db/widget/embed.js" data-widget-key="{$widgetKey}" async></script>
HTML;

        $snippets = match ($lang) {
            'php' => $this->phpSnippet($baseUrl, $widgetKey),
            'python' => $this->pythonSnippet($baseUrl, $widgetKey),
            'react' => $this->reactSnippet($baseUrl, $widgetKey),
            'vue' => $this->vueSnippet($baseUrl, $widgetKey),
            'laravel' => $this->laravelSnippet($baseUrl, $widgetKey),
            'dotnet' => $this->dotnetSnippet($baseUrl, $widgetKey),
            'java' => $this->javaSnippet($baseUrl, $widgetKey),
            default => $this->javascriptSnippet($baseUrl, $widgetKey),
        };

        return [
            'universal' => $scriptTag,
            'language' => $lang,
            'snippet' => $snippets,
            'widget_key' => $widgetKey,
            'gateway_url' => $baseUrl,
        ];
    }

    protected function javascriptSnippet(string $baseUrl, string $widgetKey): string
    {
        return <<<HTML
<!-- DefComm Secure DB Widget -->
<script src="{$baseUrl}/secure-db/widget/embed.js" data-widget-key="{$widgetKey}" async></script>
HTML;
    }

    protected function phpSnippet(string $baseUrl, string $widgetKey): string
    {
        return <<<PHP
<?php
// DefComm Secure DB Widget — add before </body>
?>
<script src="<?= htmlspecialchars('{$baseUrl}/secure-db/widget/embed.js') ?>"
        data-widget-key="<?= htmlspecialchars('{$widgetKey}') ?>"
        async></script>
PHP;
    }

    protected function pythonSnippet(string $baseUrl, string $widgetKey): string
    {
        return <<<PYTHON
# DefComm Secure DB Widget (Flask/Jinja example)
# Add to your base template before </body>:
#
# <script src="{{ gateway_url }}/secure-db/widget/embed.js"
#         data-widget-key="{{ widget_key }}" async></script>
#
# Context: gateway_url='{$baseUrl}', widget_key='{$widgetKey}'
PYTHON;
    }

    protected function reactSnippet(string $baseUrl, string $widgetKey): string
    {
        return <<<JSX
// DefComm Secure DB Widget — add to App.jsx or layout component
import { useEffect } from 'react';

export function SecureDbWidget() {
  useEffect(() => {
    if (document.querySelector('[data-widget-key="{$widgetKey}"]')) return;
    const s = document.createElement('script');
    s.src = '{$baseUrl}/secure-db/widget/embed.js';
    s.dataset.widgetKey = '{$widgetKey}';
    s.async = true;
    document.body.appendChild(s);
  }, []);
  return null;
}
JSX;
    }

    protected function vueSnippet(string $baseUrl, string $widgetKey): string
    {
        return <<<VUE
<!-- DefComm Secure DB Widget — App.vue mounted hook -->
<script setup>
import { onMounted } from 'vue';
onMounted(() => {
  if (document.querySelector('[data-widget-key="{$widgetKey}"]')) return;
  const s = document.createElement('script');
  s.src = '{$baseUrl}/secure-db/widget/embed.js';
  s.dataset.widgetKey = '{$widgetKey}';
  s.async = true;
  document.body.appendChild(s);
});
</script>
VUE;
    }

    protected function laravelSnippet(string $baseUrl, string $widgetKey): string
    {
        return <<<BLADE
{{-- DefComm Secure DB Widget — resources/views/layouts/app.blade.php --}}
@push('scripts')
<script src="{{ config('app.url') }}/secure-db/widget/embed.js"
        data-widget-key="{{ '{$widgetKey}' }}"
        async></script>
@endpush
BLADE;
    }

    protected function dotnetSnippet(string $baseUrl, string $widgetKey): string
    {
        return <<<CS
@* DefComm Secure DB Widget — _Layout.cshtml *@
<script src="{$baseUrl}/secure-db/widget/embed.js"
        data-widget-key="{$widgetKey}" async></script>
CS;
    }

    protected function javaSnippet(string $baseUrl, string $widgetKey): string
    {
        return <<<JAVA
<!-- DefComm Secure DB Widget — Thymeleaf layout.html -->
<script th:src="@{|{$baseUrl}/secure-db/widget/embed.js|}"
        th:attr="data-widget-key='{$widgetKey}'" async></script>
JAVA;
    }

    public function verifySecret(SecureDbWidget $widget, string $secret): bool
    {
        return Hash::check($secret, $widget->secret_key_hash);
    }

    public function recordAccess(SecureDbWidget $widget): void
    {
        $widget->increment('access_count');
        $widget->update(['last_used_at' => now()]);
    }
}
