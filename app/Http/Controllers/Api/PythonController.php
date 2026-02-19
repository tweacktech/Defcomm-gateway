<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class PythonController extends Controller
{
    public function run(Request $request)
    {
        try {
            $result = Process::run('python3 '.base_path('/Services/pythonService/python_scripts/speech.py'));

            if ($result->failed()) {
                return response()->json([
                    'success' => false,
                    'error' => $result->errorOutput(),
                ], 500);
            }

            return response()->json([
                'success' => true,
                'output' => $result->output(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // For passing arguments (source lang, target lang, text)
    public function translate(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'source_lang' => 'required|string',
            'target_lang' => 'required|string',
        ]);

        // Escape arguments to prevent shell injection
        $text = escapeshellarg($request->text);
        $sourceLang = escapeshellarg($request->source_lang);
        $targetLang = escapeshellarg($request->target_lang);
        $script = base_path('python_scripts/speech.py');

        $result = Process::run("python3 {$script} --source {$sourceLang} --target {$targetLang} --text {$text}");

        if ($result->failed()) {
            return response()->json([
                'success' => false,
                'error' => $result->errorOutput(),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'output' => trim($result->output()),
        ]);
    }

    // For passing an audio file
    public function translateAudio(Request $request)
    {
        $request->validate([
            'audio' => 'required|file|mimes:wav,mp3,ogg',
            'source_lang' => 'required|string',
            'target_lang' => 'required|string',
        ]);

        // Store audio temporarily
        $path = $request->file('audio')->store('temp/audio');
        $fullPath = escapeshellarg(storage_path("app/{$path}"));
        $sourceLang = escapeshellarg($request->source_lang);
        $targetLang = escapeshellarg($request->target_lang);
        $script = base_path('python_scripts/speech.py');

        $result = Process::run(
            "python3 {$script} --source {$sourceLang} --target {$targetLang} --file {$fullPath}"
        );

        // Clean up temp file
        Storage::delete($path);

        if ($result->failed()) {
            return response()->json([
                'success' => false,
                'error' => $result->errorOutput(),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'output' => trim($result->output()),
        ]);
    }
}
