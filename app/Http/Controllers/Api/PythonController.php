<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PythonController extends Controller
{
    use LogsActivity;

    private function getPythonPath(): string
    {
        return env('PYTHON_PATH', 'python3');
    }

    private function getScriptPath(): string
    {
        return base_path('app/Services/pythonService/speech.py');
    }

    private function getFullStoragePath(string $relativePath): string
    {
        return Storage::disk('local')->path($relativePath);
    }

    private function audioUrl(string $relativePath): string
    {
        return url('/audio/serve?path=' . urlencode($relativePath));
        // return url('/api/audio/serve?path=' . urlencode($relativePath));
    }

    /*
    |--------------------------------------------------------------------------
    | Simple Run
    |--------------------------------------------------------------------------
    */
    public function run(Request $request)
    {
        try {
            $result = Process::timeout(60)->run([
                $this->getPythonPath(),
                $this->getScriptPath(),
                '--source', 'english',
                '--target', 'english',
                '--text',   'ping',
            ]);

            if ($result->failed()) {
                return response()->json([
                    'success' => false,
                    'error'   => $result->errorOutput(),
                ], 500);
            }

            return response()->json([
                'success' => true,
                'output'  => trim($result->output()),
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Text Translation
    |--------------------------------------------------------------------------
    */
    public function translateText(Request $request)
    {
        try {
            $request->validate([
                'text'        => 'required|string|max:6000',
                'source_lang' => 'required|string',
                'target_lang' => 'required|string',
            ]);

            $result = Process::timeout(60)->run([
                $this->getPythonPath(),
                $this->getScriptPath(),
                '--source', $request->input('source_lang'),
                '--target', $request->input('target_lang'),
                '--text',   $request->input('text'),
            ]);

            if ($result->failed()) {
                return response()->json([
                    'success' => false,
                    'error'   => $result->errorOutput(),
                ], 500);
            }

            return response()->json([
                'success' => true,
                'output'  => trim($result->output()),
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Translate Audio (FILE → TEXT → AUDIO)
    |--------------------------------------------------------------------------
    */
    public function translateAudio(Request $request)
    {
        try {
            $request->validate([
                'audio'       => 'required|file|mimes:wav,mp3,ogg,mp4',
                'source_lang' => 'required|string',
                'target_lang' => 'required|string',
            ]);

            $inputPath     = $request->file('audio')->store('audio/input', 'local');
            $fullInputPath = $this->getFullStoragePath($inputPath);

            Log::debug('translateAudio input', [
                'full'   => $fullInputPath,
                'exists' => file_exists($fullInputPath),
            ]);

            if (!file_exists($fullInputPath)) {
                return response()->json([
                    'success' => false,
                    'error'   => 'Input file not saved at: ' . $fullInputPath,
                ], 500);
            }

            $outputFilename     = 'tts_' . Str::uuid() . '.mp3';
            $relativeOutputPath = 'audio/' . $outputFilename;
            $fullOutputPath     = $this->getFullStoragePath($relativeOutputPath);

            $result = Process::timeout(120)->run([
                $this->getPythonPath(),
                $this->getScriptPath(),
                '--source',      $request->input('source_lang'),
                '--target',      $request->input('target_lang'),
                '--file',        $fullInputPath,
                '--tts',
                '--save-output', $fullOutputPath,
            ]);

            Storage::disk('local')->delete($inputPath);

            Log::debug('translateAudio result', [
                'stdout'       => $result->output(),
                'stderr'       => $result->errorOutput(),
                'exitCode'     => $result->exitCode(),
                'outputExists' => file_exists($fullOutputPath),
            ]);

            if ($result->failed()) {
                return response()->json([
                    'success' => false,
                    'error'   => $result->errorOutput(),
                    'stdout'  => $result->output(),
                ], 500);
            }

            if (!file_exists($fullOutputPath)) {
                return response()->json([
                    'success' => false,
                    'error'   => 'Audio file not created',
                    'stdout'  => $result->output(),
                    'stderr'  => $result->errorOutput(),
                ], 500);
            }

            return response()->json([
                'success'   => true,
                'output'    => trim($result->output()),
                'audio_url' => $this->audioUrl($relativeOutputPath),
            ]);

        } catch (\Throwable $e) {
            Log::error('translateAudio exception', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Text → Translate → Audio
    |--------------------------------------------------------------------------
    */
    public function textTranslateAudio(Request $request)
    {
        try {
            $request->validate([
                'text'        => 'required|string|max:6000',
                'source_lang' => 'required|string',
                'target_lang' => 'required|string',
            ]);

            $filename           = 'tts_' . Str::uuid() . '.wav';
            $relativeOutputPath = 'audio/' . $filename;
            $fullOutputPath     = $this->getFullStoragePath($relativeOutputPath);

            Log::debug('textTranslateAudio output path', [
                'full' => $fullOutputPath,
            ]);

            $result = Process::timeout(60)->run([
                $this->getPythonPath(),
                $this->getScriptPath(),
                '--source',      $request->input('source_lang'),
                '--target',      $request->input('target_lang'),
                '--text',        $request->input('text'),
                '--tts',
                '--save-output', $fullOutputPath,
            ]);

            Log::debug('textTranslateAudio result', [
                'stdout'       => $result->output(),
                'stderr'       => $result->errorOutput(),
                'exitCode'     => $result->exitCode(),
                'outputExists' => file_exists($fullOutputPath),
            ]);

            if ($result->failed()) {
                return response()->json([
                    'success' => false,
                    'error'   => $result->errorOutput(),
                ], 500);
            }

            if (!file_exists($fullOutputPath)) {
                return response()->json([
                    'success' => false,
                    'error'   => 'Audio file not created',
                    'stdout'  => $result->output(),
                    'stderr'  => $result->errorOutput(),
                ], 500);
            }

            return response()->json([
                'success'   => true,
                'output'    => trim($result->output()),
                'audio_url' => $this->audioUrl($relativeOutputPath),
            ]);

        } catch (\Throwable $e) {
            Log::error('textTranslateAudio exception', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Serve Audio
    |--------------------------------------------------------------------------
    */
    public function serveAudio(Request $request)
    {
        $path = $request->query('path');

        if (!$path || str_contains($path, '..')) {
            abort(403, 'Forbidden');
        }

        if (!str_starts_with($path, 'audio/')) {
            abort(403, 'Forbidden');
        }

        $fullPath = $this->getFullStoragePath($path);

        Log::debug('serveAudio', [
            'path'   => $path,
            'full'   => $fullPath,
            'exists' => file_exists($fullPath),
        ]);

        if (!file_exists($fullPath)) {
            abort(404, 'Audio file not found');
        }

        return response()->file($fullPath, [
            'Content-Type'        => mime_content_type($fullPath),
            'Content-Disposition' => 'inline',
        ]);
    }
}
