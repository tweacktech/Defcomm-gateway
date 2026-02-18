<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Services\GoogleAiTransService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TranslatorController extends Controller
{
    /**
     * Translate text using the Google AI translation service.
     * Request parameters: text, source_language (optional), target_language (required)
     * Response: JSON with source_language, target_language, original text, and translated text.
     *@requestParam string text The text to translate.
     *@requestParam string source_language The source language code (optional, defaults to 'en').
     *@requestParam string target_language The target language code (required).
     * @return JsonResponse
     */
    public function c(Request $request, GoogleAiTransService $translator): JsonResponse
    {
        try {
            $validated = $request->validate([
                'text' => ['required', 'string'],
                'source_language' => ['nullable', 'string'],
                'target_language' => ['required', 'string'],
            ]);

            $source = $validated['source_language'] ?? 'en';
            $target = $validated['target_language'];

            $translated = $translator->translateText(
                $validated['text'],
                $target,
                $source,
            );

            return response()->json([
                'source_language' => $source,
                'target_language' => $target,
                'text' => $validated['text'],
                'translated_text' => $translated,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Translation failed: '.$e->getMessage(),
            ], 500);
        }
    }
    public function translateAudio(Request $request, GoogleAiTransService $translator): JsonResponse
    {
        try {
            $validated = $request->validate([
                'text' => ['required', 'string'],
                'source_language' => ['nullable', 'string'],
                'target_language' => ['required', 'string'],
            ]);

            $source = $validated['source_language'] ?? 'en';
            $target = $validated['target_language'];

            $translated = $translator->translateText(
                $validated['text'],
                $target,
                $source,
            );

            return response()->json([
                'source_language' => $source,
                'target_language' => $target,
                'text' => $validated['text'],
                'translated_text' => $translated,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Translation failed: '.$e->getMessage(),
            ], 500);
        }
    }
}
