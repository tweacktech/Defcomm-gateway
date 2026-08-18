# Centralized Authentication System

This document describes the centralized authentication system for **Defcomm Gateway** that allows external services and projects to authenticate and integrate securely.

## Overview

The system supports two authentication methods:

1. **OAuth2** - For user-facing integrations (web apps, mobile apps)
2. **API Tokens** - For service-to-service authentication

---

## OAuth2 Authentication

OAuth2 allows external services to request access to resources on behalf of users, with explicit user consent.

### OAuth2 Flow

```
External Service → Redirect to /auth/authorize
                ↓
                User Login & Approval
                ↓
Redirect with Authorization Code
                ↓
Exchange Code for Access Token (POST /auth/token)
                ↓
Use Access Token to Call Protected APIs
```

### Step 1: Register Your OAuth2 Client

Contact the admin or use the dashboard to register your external service as an OAuth2 client. You'll receive:
- `client_id`: Public identifier
- `client_secret`: Private secret (keep secure!)

### Step 2: Redirect Users to Authorization

```
GET /auth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_CALLBACK_URL&scope=read&state=RANDOM_STATE
```

**Parameters:**
- `client_id` - Your registered client ID
- `redirect_uri` - Your callback URL (must match registered URL)
- `scope` - Space-separated scopes (e.g., "read write profile")
- `state` - Random string for CSRF protection

### Step 3: User Authorizes Your App

The user logs in (if not already) and sees an approval screen. Upon approval, they're redirected to:

```
YOUR_CALLBACK_URL?code=AUTHORIZATION_CODE&state=RANDOM_STATE
```

**Important:** Always verify the `state` parameter matches what you sent in Step 2.

### Step 4: Exchange Authorization Code for Access Token

```bash
curl -X POST https://defcomm.gateway/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTHORIZATION_CODE",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uri": "YOUR_CALLBACK_URL"
  }'
```

**Response:**
```json
{
  "access_token": "ACCESS_TOKEN",
  "refresh_token": "REFRESH_TOKEN",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Step 5: Use the Access Token

Include the access token in API requests:

```bash
curl https://defcomm.gateway/api/central-auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

### Refresh Access Token

Access tokens expire after 1 hour. Use the refresh token to get a new one:

```bash
curl -X POST https://defcomm.gateway/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "REFRESH_TOKEN",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET"
  }'
```

---

## API Token Authentication

API Tokens are simpler tokens for service-to-service communication. They're ideal for:
- Backend-to-backend communication
- Automated tasks
- Scheduled jobs

### Step 1: Create an API Token

**Via Dashboard:**
User navigates to Settings → API Tokens → Create New Token

**Via API (for users):**
```bash
curl -X POST https://defcomm.gateway/api/central-auth/api-tokens \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mobile App",
    "scopes": ["read", "write"],
    "expires_in_days": 365
  }'
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "name": "Mobile App",
    "scopes": ["read", "write"],
    "last_used_at": null,
    "expires_at": "2027-07-16T00:00:00Z",
    "is_active": true,
    "created_at": "2026-07-16T00:00:00Z"
  },
  "token": "token_abcdef123456... (save this securely!)"
}
```

**Important:** The plain token is returned only once. Store it securely.

### Step 2: Use the API Token

Include the token in API requests:

```bash
curl https://defcomm.gateway/api/central-auth/me \
  -H "Authorization: Bearer token_abcdef123456..."
```

### Verify API Token

Services can verify if a token is valid without using it:

```bash
curl https://defcomm.gateway/api/central-auth/verify-token \
  -H "Authorization: Bearer token_abcdef123456..."
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "scopes": ["read", "write"]
}
```

### Revoke API Token

```bash
curl -X DELETE https://defcomm.gateway/api/central-auth/api-tokens/1 \
  -H "Authorization: Bearer USER_TOKEN"
```

---

## Available Endpoints

### OAuth2 Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/auth/authorize` | - | Start OAuth2 flow (redirects user) |
| `POST` | `/auth/authorize` | ✓ | User approves access |
| `POST` | `/api/central-auth/token` | - | Exchange code/refresh for token |

### API Token Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/central-auth/me` | ✓ | Get authenticated user profile |
| `GET` | `/api/central-auth/api-tokens` | ✓ | List all API tokens |
| `POST` | `/api/central-auth/api-tokens` | ✓ | Create new API token |
| `DELETE` | `/api/central-auth/api-tokens/{id}` | ✓ | Revoke API token |

### Verification Endpoints (Public)

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/api/central-auth/verify-token` | Token | Verify API token validity |
| `GET` | `/api/central-auth/verify-oauth` | OAuth Token | Verify OAuth2 token validity |

---

## Integration Examples

### JavaScript / Node.js (OAuth2)

```javascript
// 1. Redirect user to authorization
const authorizeUrl = new URL('https://defcomm.gateway/auth/authorize');
authorizeUrl.searchParams.append('client_id', 'YOUR_CLIENT_ID');
authorizeUrl.searchParams.append('redirect_uri', 'https://yourapp.com/callback');
authorizeUrl.searchParams.append('scope', 'read write');
authorizeUrl.searchParams.append('state', generateRandomState());

window.location.href = authorizeUrl.toString();

// 2. In your callback endpoint, exchange code for token
const response = await fetch('https://defcomm.gateway/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code: authorizationCode,
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    redirect_uri: 'https://yourapp.com/callback',
  }),
});

const { access_token, refresh_token } = await response.json();
// Store tokens securely (HttpOnly cookies recommended)

// 3. Use access token in API calls
const userResponse = await fetch('https://defcomm.gateway/api/central-auth/me', {
  headers: { 'Authorization': `Bearer ${access_token}` },
});

const user = await userResponse.json();
```

### Python (API Token)

```python
import requests

# Create API token
response = requests.post(
    'https://defcomm.gateway/api/central-auth/api-tokens',
    headers={'Authorization': f'Bearer {user_token}'},
    json={
        'name': 'Python Script',
        'scopes': ['read', 'write'],
        'expires_in_days': 30,
    }
)

token_data = response.json()
api_token = token_data['token']

# Use API token in requests
headers = {'Authorization': f'Bearer {api_token}'}

# Verify token
verify_response = requests.get(
    'https://defcomm.gateway/api/central-auth/verify-token',
    headers=headers
)

if verify_response.status_code == 200:
    print("Token is valid!")
    print(verify_response.json())
```

### PHP (API Token)

```php
<?php

// Create API token
$curl = curl_init('https://defcomm.gateway/api/central-auth/api-tokens');
curl_setopt($curl, CURLOPT_POST, true);
curl_setopt($curl, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $userToken,
    'Content-Type: application/json',
]);
curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode([
    'name' => 'PHP Script',
    'scopes' => ['read', 'write'],
    'expires_in_days' => 30,
]));

$response = curl_exec($curl);
$tokenData = json_decode($response, true);
$apiToken = $tokenData['token'];

// Use API token
$curl = curl_init('https://defcomm.gateway/api/central-auth/me');
curl_setopt($curl, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $apiToken,
]);

$response = curl_exec($curl);
$user = json_decode($response, true);
```

---

## Scopes

Scopes define what permissions an API token or OAuth2 access has.

| Scope | Description |
|-------|-------------|
| `read` | Read-only access to user data |
| `write` | Modify user data |
| `admin` | Administrative access (user data, organization settings) |

---

## Security Best Practices

### For OAuth2 Clients

1. **Keep client_secret secure** - Never expose it in client-side code
2. **Verify state parameter** - Always validate the state parameter in callbacks
3. **Use HTTPS only** - All requests must use HTTPS
4. **Securely store tokens** - Use HttpOnly, Secure cookies or encrypted storage
5. **Handle token expiration** - Implement refresh token rotation
6. **Validate redirect_uri** - Ensure your callback domain is registered

### For API Token Users

1. **Keep tokens secret** - Treat API tokens like passwords
2. **Set expiration dates** - Use short-lived tokens when possible
3. **Rotate regularly** - Create new tokens and revoke old ones
4. **Use minimal scopes** - Only request scopes you need
5. **Monitor usage** - Check last_used_at to detect unauthorized use
6. **Revoke immediately** - If a token is compromised, revoke it immediately

---

## Middleware Usage (Laravel)

To protect routes with API token authentication:

```php
Route::middleware(['auth:api.token'])->group(function () {
    Route::get('/protected', function (Request $request) {
        // $request->apiToken contains token info
        // $request->user() contains authenticated user
    });
});
```

To check token scopes:

```php
Route::get('/data', function (Request $request) {
    if (!$request->user()->tokenCan('read')) {
        return response()->json(['error' => 'Insufficient permissions'], 403);
    }
    // Return data
});
```

---

## Troubleshooting

### Invalid Authorization Code

**Cause:** Code has expired or been used already
- Authorization codes expire after 10 minutes
- Each code can only be used once

**Solution:** Start the OAuth2 flow again

### Invalid Token

**Cause:** Token is invalid, expired, or revoked

**Solution:** 
- Verify the token format (should be `token_...`)
- Check if token has been revoked
- Use the verify endpoint to debug

### Redirect URI Mismatch

**Cause:** The `redirect_uri` in the request doesn't match the registered URI

**Solution:** Register the correct callback URI in your OAuth2 client settings

---

## Support

For issues or questions about the centralized auth system:

1. Check the troubleshooting section above
2. Review the code examples
3. Contact the Defcomm team or your administrator

---

**Last Updated:** July 16, 2026
**Version:** 1.0
