<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Defcomm Invitation</title>
</head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111; padding: 24px;">
    <h2 style="margin: 0 0 12px;">You're invited to Defcomm</h2>
    <p>You have been invited to join <strong>{{ $organizationName }}</strong>.</p>
    <p>Click the button below to set up your account. This link expires on {{ $invitation->expires_at->toDayDateTimeString() }}.</p>
    <p style="margin: 24px 0;">
        <a href="{{ $setupUrl }}"
           style="display:inline-block;background:#3d5c1a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
            Set up your account
        </a>
    </p>
    <p style="font-size: 13px; color: #555;">If the button does not work, copy this link:<br>{{ $setupUrl }}</p>
</body>
</html>
