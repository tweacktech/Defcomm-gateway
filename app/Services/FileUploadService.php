<?php

namespace App\Http\Services;

use App\Models\Files;
use App\Models\ChatLastLog;
use App\Models\ChatMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FileUploadService
{
    public function submitFile($request)
    {
        $file = $request->file('message');
        $file_ext = $file->getClientOriginalExtension();

        // return dd($file_ext != "pdf" || $file_ext != "PDF");

        if ($file_ext != "pdf") {
            return ['status' => false, 'message' => "Ensure the file is PDF"];
        }

        $file_size = $fileSize = $file->getSize();
        $file_name = time() . "secure." . $file->getClientOriginalExtension();
        $file->move(public_path('secure'), $file_name);

        if ($file_size >= 1073741824) {
            $file_size = number_format($file_size / 1073741824, 2) . ' GB';
        } elseif ($file_size >= 1048576) {
            $file_size = number_format($file_size / 1048576, 2) . ' MB';
        } elseif ($file_size >= 1024) {
            $file_size = number_format($file_size / 1024, 2) . ' KB';
        } else {
            $file_size = $file_size . ' bytes';
        }

        $file = Files::create([
            'name' => $request->name ?? $file->getClientOriginalName(),
            'description' => $request->description,
            'file' => $file_name,
            'file_size' => $file_size,
            'file_ext' => $file_ext,
            'fileSize_num' => $fileSize,
            'company_id' => auth()->user()->company_id,
            'uploaded_by' => auth()->user()->id,
        ]);

        return ['status' => true, 'message' => "sucessfully", 'data' => $file];
    }

    function makeAudioTemporarilyPublic(string $storagePath): string
    {
        // 1. Ensure file exists in storage
        // if (!Storage::disk('local')->exists($storagePath)) {
        //     throw new \Exception("File not found: {$storagePath}");
        // }

        // 2. Copy to a temporary public folder
        $filename = basename($storagePath);
        $publicPath = "temp-audio/" . time() . "_" . $filename;

        Storage::disk('public')->put($publicPath, Storage::disk('local')->get($storagePath));

        // 3. Return the public URL
        return Storage::url($publicPath);
    }
}