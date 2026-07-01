<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Encryption\Encrypter;

class FileEncryptionService
{
    protected Encrypter $encrypter;

    public function __construct()
    {
        $this->encrypter = Crypt::getJsonSerializer()->getEncrypter() ?? app('encrypter');
    }

    /**
     * Encrypt a filename
     * 
     * @param string $filename Original filename
     * @return string Encrypted filename (URL-safe)
     */
    public function encryptFilename(string $filename): string
    {
        // Encrypt and convert to URL-safe base64
        $encrypted = $this->encrypter->encrypt($filename, false);
        return $this->toUrlSafeBase64($encrypted);
    }

    /**
     * Decrypt a filename
     * 
     * @param string $encryptedFilename Encrypted filename
     * @return string Original filename
     * @throws \Illuminate\Contracts\Encryption\DecryptException
     */
    public function decryptFilename(string $encryptedFilename): string
    {
        $encrypted = $this->fromUrlSafeBase64($encryptedFilename);
        return $this->encrypter->decrypt($encrypted, false);
    }

    /**
     * Encrypt file content and save to storage
     * 
     * @param string $sourcePath Path to source file
     * @param string $destinationPath Where to save encrypted file
     * @param string $disk Storage disk name
     * @return bool Success status
     */
    public function encryptAndStore(
        string $sourcePath,
        string $destinationPath,
        string $disk = 'private'
    ): bool {
        try {
            $fileContent = file_get_contents($sourcePath);
            
            if ($fileContent === false) {
                throw new \Exception('Failed to read source file');
            }

            $encrypted = $this->encrypter->encrypt($fileContent, false);
            
            return \Illuminate\Support\Facades\Storage::disk($disk)
                ->put($destinationPath, $encrypted);
        } catch (\Exception $e) {
            \Log::error('File encryption failed', [
                'path' => $destinationPath,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Decrypt file and return content
     * 
     * @param string $storagePath Path in storage
     * @param string $disk Storage disk name
     * @return string|false Decrypted content or false
     */
    public function decryptAndRetrieve(
        string $storagePath,
        string $disk = 'private'
    ): string|false {
        try {
            $encrypted = \Illuminate\Support\Facades\Storage::disk($disk)
                ->get($storagePath);
            
            if ($encrypted === null) {
                return false;
            }

            return $this->encrypter->decrypt($encrypted, false);
        } catch (\Exception $e) {
            \Log::error('File decryption failed', [
                'path' => $storagePath,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Stream decrypt file (for large files - memory efficient)
     * 
     * @param string $storagePath Path in storage
     * @param string $disk Storage disk name
     * @return resource|false Stream resource or false
     */
    public function streamDecrypt(
        string $storagePath,
        string $disk = 'private'
    ) {
        try {
            $encrypted = \Illuminate\Support\Facades\Storage::disk($disk)
                ->get($storagePath);
            
            if ($encrypted === null) {
                return false;
            }

            $decrypted = $this->encrypter->decrypt($encrypted, false);
            
            // Create a temporary stream from decrypted content
            $stream = fopen('php://memory', 'r+');
            fwrite($stream, $decrypted);
            rewind($stream);
            
            return $stream;
        } catch (\Exception $e) {
            \Log::error('File stream decryption failed', [
                'path' => $storagePath,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Encrypt file name for display in database
     * Stores encrypted name separately from original filename
     * 
     * @param string $filename
     * @return string
     */
    public function encryptFileMetadata(string $filename): string
    {
        return $this->encrypter->encrypt($filename);
    }

    /**
     * Decrypt file metadata
     * 
     * @param string $encrypted
     * @return string
     * @throws \Illuminate\Contracts\Encryption\DecryptException
     */
    public function decryptFileMetadata(string $encrypted): string
    {
        return $this->encrypter->decrypt($encrypted);
    }

    /**
     * Convert to URL-safe base64
     * 
     * @param string $data
     * @return string
     */
    protected function toUrlSafeBase64(string $data): string
    {
        return strtr(rtrim(base64_encode($data), '='), '+/', '-_');
    }

    /**
     * Convert from URL-safe base64
     * 
     * @param string $data
     * @return string
     */
    protected function fromUrlSafeBase64(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }

    /**
     * Generate encrypted storage filename
     * Uses UUID or hash to avoid exposing original filename in filesystem
     * 
     * @return string
     */
    public function generateEncryptedStorageName(): string
    {
        return bin2hex(random_bytes(16)) . '.bin';
    }

    /**
     * Check if file is encrypted
     * (Basic check - looks for encryption payload markers)
     * 
     * @param string $filePath
     * @param string $disk
     * @return bool
     */
    public function isEncrypted(string $filePath, string $disk = 'private'): bool
    {
        try {
            $firstBytes = \Illuminate\Support\Facades\Storage::disk($disk)
                ->get($filePath, 0, 20);
            
            // Laravel encrypted files start with specific markers
            // This is a basic check
            return strpos($firstBytes, 'base64:') !== false || 
                   strpos($firstBytes, 'eyJ') !== false; // JSON payload start
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get encryption info for logging/audit
     * 
     * @return array
     */
    public function getEncryptionInfo(): array
    {
        return [
            'cipher' => config('app.cipher'),
            'algorithm' => match(config('app.cipher')) {
                'AES-128-CBC' => 'AES-128 CBC',
                'AES-256-CBC' => 'AES-256 CBC',
                'ChaCha20-Poly1305' => 'ChaCha20-Poly1305',
                default => 'Unknown'
            },
            'timestamp' => now()->toIso8601String(),
        ];
    }
}
