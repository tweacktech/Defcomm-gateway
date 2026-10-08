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
            'allowed_origins' => $this->normalizeAllowedOrigins($allowedOrigins),
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

    public function update(SecureDbWidget $widget, array $data): SecureDbWidget
    {
        if (isset($data['database_type']) && ! array_key_exists($data['database_type'], self::DATABASE_MARKET)) {
            throw new \InvalidArgumentException("Unsupported database type: {$data['database_type']}");
        }

        $widget->update([
            'project_id' => $data['project_id'] ?? $widget->project_id,
            'name' => $data['name'],
            'language' => $data['language'],
            'database_type' => $data['database_type'],
            'allowed_origins' => $this->normalizeAllowedOrigins($data['allowed_origins'] ?? null),
        ]);

        return $widget->fresh(['project']) ?? $widget;
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

    public function originIsAllowed(SecureDbWidget $widget, ?string $origin, ?string $referer = null): bool
    {
        $allowed = $this->normalizeAllowedOrigins($widget->allowed_origins);
        if ($allowed === null) {
            return true;
        }

        foreach ($allowed as $pattern) {
            if ($pattern === '*') {
                return true;
            }
        }

        $candidates = [];
        foreach ([$origin, $referer] as $value) {
            $trimmed = is_string($value) ? trim($value) : '';
            if ($trimmed !== '') {
                $candidates[] = $trimmed;
            }
        }

        if ($candidates === []) {
            return true;
        }

        foreach ($allowed as $pattern) {
            foreach ($candidates as $candidate) {
                if ($this->originMatches($pattern, $candidate)) {
                    return true;
                }
            }
        }

        return false;
    }

    public function normalizeAllowedOrigins(?array $origins): ?array
    {
        if ($origins === null) {
            return null;
        }

        $normalized = [];
        foreach ($origins as $origin) {
            if (! is_string($origin)) {
                continue;
            }
            $origin = trim($origin);
            if ($origin === '') {
                continue;
            }
            $normalized[] = $origin;
        }

        return $normalized === [] ? null : array_values(array_unique($normalized));
    }

    protected function originMatches(string $pattern, string $candidate): bool
    {
        $pattern = trim($pattern);
        $candidate = trim($candidate);

        if ($pattern === '*' || $candidate === '*') {
            return true;
        }

        $opaqueCandidate = $this->isOpaqueOrigin($candidate);
        $patternParts = $this->parseOriginValue($pattern);
        $candidateParts = $opaqueCandidate ? null : $this->parseOriginValue($candidate);

        if (($patternParts['scheme'] ?? null) === 'file') {
            return $opaqueCandidate
                || ($candidateParts['scheme'] ?? null) === 'file'
                || $this->isLoopbackHost($candidateParts['host'] ?? null);
        }

        if ($opaqueCandidate) {
            return false;
        }

        if (! $patternParts || ! $candidateParts) {
            return str_contains(strtolower($candidate), strtolower($pattern));
        }

        if (! $this->hostsMatch($patternParts['host'], $candidateParts['host'])) {
            return false;
        }

        if ($patternParts['port_explicit'] && $patternParts['port'] !== $candidateParts['port']) {
            return false;
        }

        if ($patternParts['scheme_explicit'] && $patternParts['scheme'] !== $candidateParts['scheme']) {
            return false;
        }

        return true;
    }

    protected function isOpaqueOrigin(string $value): bool
    {
        return strtolower(trim($value)) === 'null';
    }

    protected function isLoopbackHost(?string $host): bool
    {
        $host = $this->canonicalHost($host ?? '');

        return in_array($host, ['127.0.0.1', '::1'], true);
    }

    protected function hostsMatch(?string $patternHost, ?string $candidateHost): bool
    {
        return $this->canonicalHost($patternHost ?? '') === $this->canonicalHost($candidateHost ?? '')
            && ($patternHost !== null && $patternHost !== '');
    }

    protected function canonicalHost(string $host): string
    {
        $host = strtolower(trim($host, '[]'));

        return match ($host) {
            'localhost', '127.0.0.1' => '127.0.0.1',
            '::1', '0:0:0:0:0:0:0:1' => '::1',
            default => $host,
        };
    }

    /**
     * @return array{scheme:?string,host:?string,port:?int,scheme_explicit:bool,port_explicit:bool}|null
     */
    protected function parseOriginValue(string $value): ?array
    {
        $value = trim($value);
        if ($value === '' || $this->isOpaqueOrigin($value)) {
            return null;
        }

        $schemeExplicit = (bool) preg_match('#^[a-z][a-z0-9+.-]*://#i', $value);
        if (! $schemeExplicit) {
            $value = 'http://'.$value;
        }

        $parts = parse_url($value);
        if (! is_array($parts)) {
            return null;
        }

        $scheme = strtolower($parts['scheme'] ?? 'http');
        $host = isset($parts['host']) ? strtolower($parts['host']) : null;
        if ($host === null && $scheme === 'file') {
            $host = '';
        }

        $portExplicit = isset($parts['port']);
        $port = $parts['port'] ?? match ($scheme) {
            'https' => 443,
            'http' => 80,
            default => null,
        };

        return [
            'scheme' => $scheme,
            'host' => $host,
            'port' => $port,
            'scheme_explicit' => $schemeExplicit,
            'port_explicit' => $portExplicit,
        ];
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
