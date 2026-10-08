<?php

namespace Tests\Unit\SecureDB;

use App\Modules\SecureDB\Models\SecureDbWidget;
use App\Modules\SecureDB\Services\WidgetService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class WidgetOriginAllowanceTest extends TestCase
{
    #[Test]
    public function file_origin_allows_browser_null_and_local_http(): void
    {
        $widget = new SecureDbWidget(['allowed_origins' => ['file:///C:/wamp64/www/test.html']]);
        $service = app(WidgetService::class);

        $this->assertTrue($service->originIsAllowed($widget, 'null', 'file:///C:/wamp64/www/test.html'));
        $this->assertTrue($service->originIsAllowed($widget, 'http://127.0.0.1:3301'));
        $this->assertTrue($service->originIsAllowed($widget, 'http://localhost:3301'));
        $this->assertFalse($service->originIsAllowed($widget, 'https://evil.example'));
    }

    #[Test]
    public function localhost_matches_loopback_ip_on_same_port(): void
    {
        $widget = new SecureDbWidget(['allowed_origins' => ['http://127.0.0.1:3301']]);
        $service = app(WidgetService::class);

        $this->assertTrue($service->originIsAllowed($widget, 'http://localhost:3301'));
        $this->assertTrue($service->originIsAllowed($widget, 'http://127.0.0.1:3301'));
        $this->assertFalse($service->originIsAllowed($widget, 'http://localhost:3303'));
        $this->assertFalse($service->originIsAllowed($widget, 'https://evil.example'));
    }

    #[Test]
    public function empty_or_wildcard_origins_allow_any(): void
    {
        $service = app(WidgetService::class);

        $empty = new SecureDbWidget(['allowed_origins' => []]);
        $wildcard = new SecureDbWidget(['allowed_origins' => ['*']]);

        $this->assertTrue($service->originIsAllowed($empty, 'https://anything.example'));
        $this->assertTrue($service->originIsAllowed($wildcard, 'https://anything.example'));
    }
}
