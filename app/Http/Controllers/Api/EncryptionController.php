<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Services\FileEncryptorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EncryptionController extends Controller
{
    /**
     * Encrypt a plaintext string for the authenticated user.
     */
    public function encryptText(Request $request, FileEncryptorService $encryptor): JsonResponse
    {
        $validated = $request->validate([
            'text' => ['required', 'string'],
        ]);

        $ciphertext = $encryptor->encrypt($validated['text']);

        return response()->json([
            'ciphertext' => $ciphertext,
        ]);
    }

    /**
     * Decrypt a previously encrypted string for the authenticated user.
     */
    public function decryptText(Request $request, FileEncryptorService $encryptor): JsonResponse
    {
        $validated = $request->validate([
            'ciphertext' => ['required', 'string'],
        ]);

        $plaintext = $encryptor->decrypt($validated['ciphertext']);

        return response()->json([
            'plaintext' => $plaintext,
        ]);
    }
}

