<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class MagicLinkMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $magicLinkUrl,
        public int $expiresInMinutes
    ) {
    }

    public function build(): self
    {
        return $this
            ->subject('Your Defcomm sign-in link')
            ->view('emails.magic-link');
    }
}
