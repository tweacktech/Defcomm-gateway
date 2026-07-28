<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f4f4f5; padding:32px 0; margin:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; padding:32px; border:1px solid #e4e4e7;">
                    <tr>
                        <td style="text-align:center; padding-bottom:16px;">
                            <span style="font-size:20px; font-weight:700; color:#111827;">Defcomm</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="text-align:center; padding-bottom:24px;">
                            <h1 style="font-size:18px; margin:0 0 8px; color:#111827;">Sign in to Defcomm</h1>
                            <p style="color:#6b7280; font-size:14px; margin:0;">
                                Click the button below to sign in. This link expires in {{ $expiresInMinutes }} minutes and can only be used once.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="text-align:center; padding-bottom:24px;">
                            <a href="{{ $magicLinkUrl }}"
                               style="background:#111827; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:14px; font-weight:600; display:inline-block;">
                                Sign in
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="text-align:center;">
                            <p style="color:#9ca3af; font-size:12px; margin:0;">
                                If you didn't request this, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
