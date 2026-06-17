<?php

namespace Tests\Unit\SecureDB;

use App\Modules\SecureDB\Services\EncryptionService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class EncryptionServiceTest extends TestCase
{
    private EncryptionService $service;
    private string $key;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new EncryptionService;
        $this->key = base64_encode(random_bytes(32));
    }

    #[Test]
    public function it_encrypts_and_decrypts_with_aes_256_gcm(): void
    {
        $plaintext = 'sensitive data value';
        $encrypted = $this->service->encryptField($plaintext, $this->key, EncryptionService::AES_256_GCM);
        $decrypted = $this->service->decryptField($encrypted, $this->key, EncryptionService::AES_256_GCM);

        $this->assertSame($plaintext, $decrypted);
    }

    #[Test]
    public function it_encrypts_and_decrypts_row_fields(): void
    {
        $row = ['id' => '1', 'email' => 'user@example.com', 'name' => 'Test'];
        $encrypted = $this->service->encryptRow($row, ['email'], $this->key);
        $this->assertNotSame($row['email'], $encrypted['email']);

        $decrypted = $this->service->decryptRow($encrypted, ['email'], $this->key);
        $this->assertSame('user@example.com', $decrypted['email']);
    }

    #[Test]
    public function it_encrypts_and_decrypts_documents(): void
    {
        $doc = ['title' => 'Secret', 'body' => 'Content'];
        $encrypted = $this->service->encryptDocument($doc, $this->key);
        $decrypted = $this->service->decryptDocument($encrypted, $this->key);

        $this->assertSame($doc, $decrypted);
    }
}
