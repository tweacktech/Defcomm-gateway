<?php

namespace App\Http\Services;

use App\Models\User;
use setasign\Fpdi\Fpdi;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\File;
use Intervention\Image\Facades\Image;
use Illuminate\Support\Str;
use RuntimeException;

class FileEncryptorService
{
    protected $encrypter;
    protected string $cipher;
    protected string $key;

    private function userkey()
    {
        if(auth()->user()->encryptorkey){
            return decrypt(auth()->user()->encryptorkey);
        }else{
            $key = base64_encode(random_bytes(32));
            User::find(auth()->user()->id)->update(['encryptorkey' => encrypt($key)]);
            return $key;
        }
    }

    public function __construct()
    {
        $key = base64_decode($this->userkey());
        $cipher =  'AES-256-CBC';
        $this->encrypter = new Encrypter($key, 'AES-256-CBC');

        $this->cipher = $cipher;
        $this->key = $key;
    }

    public function processAndEncrypt(string $inputPath, string $outputEncryptedPath, array $options = [])
    {
        $extension = strtolower(pathinfo($inputPath, PATHINFO_EXTENSION));
        $watermarkedPath = storage_path('app/temp_' . uniqid() . '.' . $extension);

        switch ($extension) {
            case 'jpg':
            case 'jpeg':
            case 'png':
                $this->addImageWatermark($inputPath, $watermarkedPath, $options);
                break;
            case 'pdf':
                $this->addPdfWatermark($inputPath, $watermarkedPath, $options);
                break;
            case 'docx':
                $this->addDocxWatermark($inputPath, $watermarkedPath, $options);
                break;
            default:
                throw new \Exception("Unsupported file type: $extension");
        }

        // Encrypt the watermarked file
        $content = File::get($watermarkedPath);
        $encrypted = $this->encrypter->encrypt($content);
        File::put($outputEncryptedPath, $encrypted);

        // Clean up temp file
        File::delete($watermarkedPath);
        File::delete($inputPath);
    }

    public function decryptFile(string $encryptedPath, string $decryptedPath)
    {
        $content = File::get($encryptedPath);
        $decrypted = $this->encrypter->decrypt($content);
        File::put($decryptedPath, $decrypted);
    }

    public function decryptAndWatermark(string $encryptedPath, string $decryptedOutputPath, string $fileExtension, array $options = [])
    {
        $extension = $fileExtension;

        // Decrypt to temp file
        $tempPath = storage_path('app/temp_decrypted_' . uniqid() . '.' . $extension);
        $content = File::get($encryptedPath);
        $decrypted = $this->encrypter->decrypt($content);
        File::put($tempPath, $decrypted);

        // Add watermark
        switch ($extension) {
            case 'jpg':
            case 'jpeg':
            case 'png':
                $this->addImageWatermark($tempPath, $decryptedOutputPath, $options);
                break;
            case 'pdf':
                $this->addPdfWatermark($tempPath, $decryptedOutputPath, $options);
                break;
            case 'docx':
                $this->addDocxWatermark($tempPath, $decryptedOutputPath, $options);
                break;
            default:
                // Just move file if no watermark processing supported
                File::move($tempPath, $decryptedOutputPath);
        }

        // Clean up
        if (File::exists($tempPath)) {
            File::delete($tempPath);
        }
    }

    protected function addImageWatermark(string $inputPath, string $outputPath, array $options)
    {
        $img = Image::make($inputPath);

        if (!empty($options['watermark_image'])) {
            $wm = Image::make($options['watermark_image'])->resize(100, 100);
            $img->insert($wm, 'bottom-right', 10, 10);
        }

        if (!empty($options['watermark_text'])) {
            $img->text($options['watermark_text'], $img->width() - 10, $img->height() - 10, function ($font) {
                $font->file(public_path('fonts/arial.ttf')); // Ensure this font exists
                $font->size(24);
                $font->color([255, 255, 255, 0.5]);
                $font->align('right');
                $font->valign('bottom');
            });
        }

        $img->save($outputPath);
    }

    protected function addPdfWatermark(string $inputPath, string $outputPath, array $options)
    {
        $pdf = new Fpdi();
        $pageCount = $pdf->setSourceFile($inputPath);

        for ($i = 1; $i <= $pageCount; $i++) {
            $tplId = $pdf->importPage($i);
            $pdf->AddPage();
            $pdf->useTemplate($tplId);

            if (!empty($options['watermark_text'])) {
                $pdf->SetFont('Arial', '', 8); // smaller and unbolded font
                $pdf->SetTextColor(230, 230, 230); // extremely faint gray

                $w = $pdf->GetPageWidth();
                $h = $pdf->GetPageHeight();

                $startY = !empty($options['y']) ? $options['y'] : 50;
                $startX = !empty($options['x']) ? $options['x'] : 30;

                for ($y = $startY; $y < $h; $y += 100) {
                    for ($x = $startX; $x < $w; $x += 120) {
                        $pdf->SetXY($x, $y);
                        $pdf->Cell(0, 10, $options['watermark_text']);
                    }
                }
            }


            // You could add image watermark here using $pdf->Image()
        }

        $pdf->Output($outputPath, 'F');
    }

    protected function addDocxWatermark(string $inputPath, string $outputPath, array $options)
    {
        $phpWord = IOFactory::load($inputPath);

        foreach ($phpWord->getSections() as $section) {
            if (!empty($options['watermark_text'])) {
                $header = $section->addHeader();
                $header->addText($options['watermark_text'], ['bold' => true, 'color' => '999999']);
            }

            if (!empty($options['watermark_image'])) {
                $header = $section->addHeader();
                $header->addImage($options['watermark_image'], [
                    'width' => 100,
                    'height' => 100,
                    'alignment' => \PhpOffice\PhpWord\SimpleType\Jc::END
                ]);
            }
        }

        $writer = IOFactory::createWriter($phpWord, 'Word2007');
        $writer->save($outputPath);
    }

    public function encrypt(string $plaintext): string
    {
        $ivLength = openssl_cipher_iv_length($this->cipher);
        $iv = random_bytes($ivLength);

        $ciphertext = openssl_encrypt($plaintext, $this->cipher, $this->key, 0, $iv);
        if ($ciphertext === false) {
            throw new RuntimeException('Encryption failed.');
        }

        return base64_encode($iv . $ciphertext);
    }

    public function decrypt(string $encrypted): string
    {
        $ivLength = openssl_cipher_iv_length($this->cipher);
        $data = base64_decode($encrypted);

        if ($data === false || strlen($data) <= $ivLength) {
            throw new RuntimeException('Invalid encrypted string.');
        }

        $iv = substr($data, 0, $ivLength);
        $ciphertext = substr($data, $ivLength);

        $plaintext = openssl_decrypt($ciphertext, $this->cipher, $this->key, 0, $iv);

        if ($plaintext === false) {
            throw new RuntimeException('Decryption failed.');
        }

        return $plaintext;
    }

    public function encryptAudio(string $inputPath, string $outputPath): void
    {
        $ivLength = openssl_cipher_iv_length($this->cipher);
        $iv = random_bytes($ivLength);

        $input = fopen($inputPath, 'rb');
        if (!$input) {
            throw new RuntimeException("Cannot open input file: $inputPath");
        }

        $output = fopen($outputPath, 'wb');
        if (!$output) {
            fclose($input);
            throw new RuntimeException("Cannot open output file: $outputPath");
        }

        // Write IV to the beginning of the file
        fwrite($output, $iv);

        while (!feof($input)) {
            $plaintext = fread($input, 4096);
            $ciphertext = openssl_encrypt($plaintext, $this->cipher, $this->key, OPENSSL_RAW_DATA, $iv);
            fwrite($output, $ciphertext);
        }

        fclose($input);
        fclose($output);
    }

    public function decryptAudio(string $inputPath, string $outputPath): void
    {
        $ivLength = openssl_cipher_iv_length($this->cipher);

        $input = fopen($inputPath, 'rb');
        if (!$input) {
            throw new RuntimeException("Cannot open encrypted file: $inputPath");
        }

        $iv = fread($input, $ivLength);

        $output = fopen($outputPath, 'wb');
        if (!$output) {
            fclose($input);
            throw new RuntimeException("Cannot open output file: $outputPath");
        }

        while (!feof($input)) {
            $ciphertext = fread($input, 4096 + 16); // Slightly larger block for padding
            $plaintext = openssl_decrypt($ciphertext, $this->cipher, $this->key, OPENSSL_RAW_DATA, $iv);
            fwrite($output, $plaintext);
        }

        fclose($input);
        fclose($output);
    }

}
