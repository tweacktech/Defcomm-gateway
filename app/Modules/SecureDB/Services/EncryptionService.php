<?php

namespace App\Modules\SecureDB\Services;

use RuntimeException;

class EncryptionService
{
    public const AES_256_GCM = 'aes-256-gcm';
    public const CHACHA20_POLY1305 = 'chacha20-poly1305';
    public const RSA_HYBRID = 'rsa-4096-hybrid';

    public function encrypt(string $plaintext, string $key, string $algorithm = self::AES_256_GCM): array
    {
        return match ($algorithm) {
            self::AES_256_GCM => $this->encryptAesGcm($plaintext, $key),
            self::CHACHA20_POLY1305 => $this->encryptChaCha($plaintext, $key),
            self::RSA_HYBRID => $this->encryptRsaHybrid($plaintext, $key),
            default => throw new RuntimeException("Unsupported algorithm: {$algorithm}"),
        };
    }

    public function decrypt(array $payload, string $key, string $algorithm = self::AES_256_GCM): string
    {
        return match ($algorithm) {
            self::AES_256_GCM => $this->decryptAesGcm($payload, $key),
            self::CHACHA20_POLY1305 => $this->decryptChaCha($payload, $key),
            self::RSA_HYBRID => $this->decryptRsaHybrid($payload, $key),
            default => throw new RuntimeException("Unsupported algorithm: {$algorithm}"),
        };
    }

    public function encryptField(string $value, string $key, string $algorithm = self::AES_256_GCM): string
    {
        $result = $this->encrypt($value, $key, $algorithm);

        return base64_encode(json_encode($result));
    }

    public function decryptField(string $encrypted, string $key, string $algorithm = self::AES_256_GCM): string
    {
        $payload = json_decode(base64_decode($encrypted), true);
        if (! is_array($payload)) {
            throw new RuntimeException('Invalid encrypted field payload.');
        }

        return $this->decrypt($payload, $key, $algorithm);
    }

    public function encryptRow(array $row, array $fields, string $key, string $algorithm = self::AES_256_GCM): array
    {
        foreach ($fields as $field) {
            if (array_key_exists($field, $row) && $row[$field] !== null) {
                $row[$field] = $this->encryptField((string) $row[$field], $key, $algorithm);
            }
        }

        return $row;
    }

    public function decryptRow(array $row, array $fields, string $key, string $algorithm = self::AES_256_GCM): array
    {
        foreach ($fields as $field) {
            if (array_key_exists($field, $row) && $row[$field] !== null) {
                $row[$field] = $this->decryptField((string) $row[$field], $key, $algorithm);
            }
        }

        return $row;
    }

    public function encryptDocument(array $document, string $key, string $algorithm = self::AES_256_GCM): string
    {
        return $this->encryptField(json_encode($document), $key, $algorithm);
    }

    public function decryptDocument(string $encrypted, string $key, string $algorithm = self::AES_256_GCM): array
    {
        $json = $this->decryptField($encrypted, $key, $algorithm);
        $document = json_decode($json, true);

        if (! is_array($document)) {
            throw new RuntimeException('Invalid decrypted document.');
        }

        return $document;
    }

    protected function encryptAesGcm(string $plaintext, string $key): array
    {
        $key = $this->normalizeKey($key, 32);
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);

        if ($ciphertext === false) {
            throw new RuntimeException('AES-256-GCM encryption failed.');
        }

        return [
            'algorithm' => self::AES_256_GCM,
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'ciphertext' => base64_encode($ciphertext),
        ];
    }

    protected function decryptAesGcm(array $payload, string $key): string
    {
        $key = $this->normalizeKey($key, 32);
        $plaintext = openssl_decrypt(
            base64_decode($payload['ciphertext']),
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            base64_decode($payload['iv']),
            base64_decode($payload['tag'])
        );

        if ($plaintext === false) {
            throw new RuntimeException('AES-256-GCM decryption failed.');
        }

        return $plaintext;
    }

    protected function encryptChaCha(string $plaintext, string $key): array
    {
        $key = $this->normalizeKey($key, 32);
        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, 'chacha20-poly1305', $key, OPENSSL_RAW_DATA, $iv, $tag);

        if ($ciphertext === false) {
            throw new RuntimeException('ChaCha20-Poly1305 encryption failed.');
        }

        return [
            'algorithm' => self::CHACHA20_POLY1305,
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'ciphertext' => base64_encode($ciphertext),
        ];
    }

    protected function decryptChaCha(array $payload, string $key): string
    {
        $key = $this->normalizeKey($key, 32);
        $plaintext = openssl_decrypt(
            base64_decode($payload['ciphertext']),
            'chacha20-poly1305',
            $key,
            OPENSSL_RAW_DATA,
            base64_decode($payload['iv']),
            base64_decode($payload['tag'])
        );

        if ($plaintext === false) {
            throw new RuntimeException('ChaCha20-Poly1305 decryption failed.');
        }

        return $plaintext;
    }

    protected function encryptRsaHybrid(string $plaintext, string $publicKeyPem): array
    {
        $dek = random_bytes(32);
        $symmetric = $this->encryptAesGcm($plaintext, $dek);

        $publicKey = openssl_pkey_get_public($publicKeyPem);
        if ($publicKey === false) {
            throw new RuntimeException('Invalid RSA public key.');
        }

        $encryptedDek = '';
        if (! openssl_public_encrypt($dek, $encryptedDek, $publicKey, OPENSSL_PKCS1_OAEP_PADDING)) {
            throw new RuntimeException('RSA encryption of DEK failed.');
        }

        return [
            'algorithm' => self::RSA_HYBRID,
            'encrypted_dek' => base64_encode($encryptedDek),
            'symmetric' => $symmetric,
        ];
    }

    protected function decryptRsaHybrid(array $payload, string $privateKeyPem): string
    {
        $privateKey = openssl_pkey_get_private($privateKeyPem);
        if ($privateKey === false) {
            throw new RuntimeException('Invalid RSA private key.');
        }

        $dek = '';
        if (! openssl_private_decrypt(
            base64_decode($payload['encrypted_dek']),
            $dek,
            $privateKey,
            OPENSSL_PKCS1_OAEP_PADDING
        )) {
            throw new RuntimeException('RSA decryption of DEK failed.');
        }

        return $this->decryptAesGcm($payload['symmetric'], $dek);
    }

    protected function normalizeKey(string $key, int $length): string
    {
        $decoded = base64_decode($key, true);
        $raw = $decoded !== false ? $decoded : $key;

        if (strlen($raw) < $length) {
            $raw = hash('sha256', $raw, true);
        }

        return substr($raw, 0, $length);
    }
}
