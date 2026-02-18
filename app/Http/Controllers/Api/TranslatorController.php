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
     */
    public function translate(Request $request, GoogleAiTransService $translator): JsonResponse
    {
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
    }
}

