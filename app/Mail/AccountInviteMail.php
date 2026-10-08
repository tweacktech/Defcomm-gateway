<?php

namespace App\Mail;

use App\Models\UserInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AccountInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public UserInvitation $invitation,
        public string $setupUrl,
        public string $organizationName,
    ) {
    }

    public function build(): self
    {
        return $this
            ->subject('You are invited to Defcomm')
            ->view('emails.account-invite');
    }
}
