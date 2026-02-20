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
            $script = base_path('app/Services/pythonService/speech.py');
            $result = Process::timeout(60)->run([
                'python3',
                $script,
                '--source',
                'english',
                '--target',
                'english',
                '--text',
                'ping',
            ]);

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
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    // For passing arguments (source lang, target lang, text)
    public function translateText(Request $request)
    {
        $request->validate([
            'text' => 'required|string',
            'source_lang' => 'required|string',
            'target_lang' => 'required|string',
        ]);

        // return $request->all();

        $script = base_path('app/Services/pythonService/speech.py');
        $result = Process::timeout(60)->run([
            'python3',
            $script,
            '--source',
            $request->string('source_lang')->toString(),
            '--target',
            $request->string('target_lang')->toString(),
            '--text',
            $request->string('text')->toString(),
        ]);

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
    // public function translateAudio(Request $request)
    // {
    //     $request->validate([
    //         'audio' => 'required|file|mimes:wav,mp3,ogg,mp4,',
    //         'source_lang' => 'required|string',
    //         'target_lang' => 'required|string',
    //     ]);

    //     // Store audio temporarily
    //     $path = $request->file('audio')->store('temp/audio');
    //     $fullPath = storage_path("app/{$path}");
    //     $script = base_path('app/Services/pythonService/speech.py');

    //     $result = Process::timeout(120)->run([
    //         'python3',
    //         $script,
    //         '--source',
    //         $request->string('source_lang')->toString(),
    //         '--target',
    //         $request->string('target_lang')->toString(),
    //         '--file',
    //         $fullPath,
    //     ]);

    //     // Clean up temp file
    //     Storage::delete($path);

    //     if ($result->failed()) {
    //         return response()->json([
    //             'success' => false,
    //             'error' => $result->errorOutput(),
    //         ], 500);
    //     }

    //     return response()->json([
    //         'success' => true,
    //         'output' => trim($result->output()),
    //     ]);
    // }

    public function translateAudio(Request $request)
    {
        try {
            $request->validate([
                'audio' => 'required|file|mimes:wav,mp3,ogg,mp4',
                'source_lang' => 'required|string',
                'target_lang' => 'required|string',
            ]);

            // return $request->audio;

            /*
            |--------------------------------------------------------------------------
            | Ensure directories exist
            |--------------------------------------------------------------------------
            */
            $tempDir = storage_path('app/temp/audio');
            $outputDir = public_path('audio');

            if (!file_exists($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            if (!file_exists($outputDir)) {
                mkdir($outputDir, 0755, true);
            }

            /*
            |--------------------------------------------------------------------------
            | Move uploaded file (IMPORTANT FIX)
            |--------------------------------------------------------------------------
            */
            $inputFilename = uniqid('input_').'.'.$request->file('audio')->extension();
            $fullPath = $tempDir.DIRECTORY_SEPARATOR.$inputFilename;

            // move instead of store()
            $request->file('audio')->move($tempDir, $inputFilename);

            // Safety check
            if (!file_exists($fullPath)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Uploaded file was not saved correctly.',
                    'path' => $fullPath,
                ], 500);
            }

            /*
            |--------------------------------------------------------------------------
            | Output audio path
            |--------------------------------------------------------------------------
            */
            $outputFilename = uniqid('tts_').'.mp3';
            $saveOutput = $outputDir.DIRECTORY_SEPARATOR.$outputFilename;

            $script = base_path('app/Services/pythonService/speech.py');

            /*
            |--------------------------------------------------------------------------
            | Run Python process
            |--------------------------------------------------------------------------
            */
            $result = Process::timeout(120)->run([
                'python3',
                $script,
                '--source', $request->input('source_lang'),
                '--target', $request->input('target_lang'),
                '--file', $fullPath,
                '--tts',
                '--save-output', $saveOutput,
            ]);

            /*
            |--------------------------------------------------------------------------
            | Delete temp input AFTER python finishes
            |--------------------------------------------------------------------------
            */
            @unlink($fullPath);

            if ($result->failed()) {
                return response()->json([
                    'success' => false,
                    'error' => $result->errorOutput(),
                    'stdout' => $result->output(),
                ], 500);
            }

            /*
            |--------------------------------------------------------------------------
            | Confirm output file exists
            |--------------------------------------------------------------------------
            */
            if (!file_exists($saveOutput)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Audio file was not created by Python.',
                    'stderr' => $result->errorOutput(),
                    'checked_path' => $saveOutput,
                ], 500);
            }

            /*
            |--------------------------------------------------------------------------
            | Success Response
            |--------------------------------------------------------------------------
            */
            return response()->json([
                'success' => true,
                'output' => trim($result->output()),
                'audio_url' => asset('audio/'.$outputFilename),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
                'line' => $e->getLine(),
            ], 500);
        }
    }

    // this translate text and then generates audio from the translated text,
    // returning both the translation and a URL to the audio file.
    public function textTranslateAudio(Request $request)
    {
        try {
            $request->validate([
                'text' => 'required|string',
                'source_lang' => 'required|string',
                'target_lang' => 'required|string',
            ]);

            $script = base_path('app/Services/pythonService/speech.py');

            // Optional: let caller specify where to save the audio output
            // $saveOutput = storage_path('app/public/audio/'.uniqid('tts_').'.mp3');
            // $saveOutput = public_path('audio/'.uniqid('tts_').'.mp3');

            // Ensure directory exists
            $audioDir = public_path('audio');
            if (!file_exists($audioDir)) {
                mkdir($audioDir, 0755, true);
            }

            $filename = uniqid('tts_').'.wav';
            $saveOutput = $audioDir.DIRECTORY_SEPARATOR.$filename;

            $result = Process::timeout(60)->run([
                'python3',
                $script,
                '--source',      $request->string('source_lang')->toString(),
                '--target',      $request->string('target_lang')->toString(),
                '--text',        $request->string('text')->toString(),
                '--tts',         // ✅ triggers text_to_speech_advanced()
                // '--play',        // ✅ plays audio on the server (remove if server has no audio)
                '--save-output', $saveOutput, // ✅ saves mp3 so you can return a URL
            ]);

            if ($result->failed()) {
                return response()->json([
                    'success' => false,
                    'error' => $result->errorOutput(),
                ], 500);
            }

            return response()->json([
                'success' => true,
                'output' => trim($result->output()),  // translated text
                'audio_url' => asset('storage/audio/'.basename($saveOutput)), // audio file URL
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
