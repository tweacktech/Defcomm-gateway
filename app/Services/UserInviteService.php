<?php

namespace App\Services;

use App\Mail\AccountInviteMail;
use App\Models\Organization;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class UserInviteService
{
    public function invite(
        ?Organization $organization,
        string $email,
        string $role,
        User $invitedBy,
        ?string $name = null,
        ?string $platformRole = null,
    ): UserInvitation {
        $email = Str::lower(trim($email));

        if ($role !== 'super' && ! $organization) {
            abort(422, 'Organization is required for admin and user invites.');
        }

        if ($role === 'super' && ! $invitedBy->isGeneralAdmin()) {
            abort(403, 'Only general admins can invite super accounts.');
        }

        $user = User::query()->where('email', $email)->first();

        if ($user) {
            if ($role !== 'super') {
                abort_unless(
                    $user->organization_id === null || (int) $user->organization_id === (int) $organization->id,
                    422,
                    'Email already belongs to another organization.'
                );
            }

            $user->update([
                'organization_id' => $role === 'super' ? null : $organization->id,
                'role' => $role,
                'platform_role' => $role === 'super' ? ($platformRole ?: 'general_admin') : null,
                'status' => $user->status === 'active' ? 'active' : 'pending',
                'name' => $name ?: ($user->name ?: Str::before($email, '@')),
            ]);
        } else {
            $user = User::create([
                'name' => $name ?: Str::before($email, '@'),
                'email' => $email,
                'password' => Hash::make(Str::random(32)),
                'role' => $role,
                'status' => 'pending',
                'organization_id' => $role === 'super' ? null : $organization->id,
                'platform_role' => $role === 'super' ? ($platformRole ?: 'general_admin') : null,
            ]);
        }

        UserInvitation::query()
            ->where('user_id', $user->id)
            ->where('status', 'pending')
            ->update(['status' => 'revoked']);

        $invitation = UserInvitation::create([
            'user_id' => $user->id,
            'organization_id' => $organization?->id,
            'invited_by' => $invitedBy->id,
            'email' => $email,
            'role' => $role,
            'token' => Str::random(64),
            'expires_at' => now()->addDays(7),
            'status' => 'pending',
        ]);

        $setupUrl = url('/invite/'.$invitation->token);
        $orgName = $organization?->name ?: config('app.name', 'Defcomm');

        Mail::to($email)->send(new AccountInviteMail(
            $invitation,
            $setupUrl,
            $orgName,
        ));

        return $invitation;
    }
}
