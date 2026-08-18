# Quick Reference Guide

## Running the System

### Initialize Database
```bash
php artisan migrate
```

### Create an OAuth2 Client
```bash
php artisan tinker
```

```php
DB::table('oauth_clients')->insert([
    'name' => 'My External App',
    'secret' => hash('sha256', 'my_client_secret'),
    'redirect_uris' => 'https://myapp.com/callback',
    'scope' => 'read write',
    'is_active' => true,
    'created_at' => now(),
    'updated_at' => now(),
]);

// Get the ID
DB::table('oauth_clients')->where('name', 'My External App')->first();
```

---

## File Analytics API

### Get Share Statistics
```bash
curl https://defcomm.gateway/drive/shares/1/analytics \
  -H "Authorization: Bearer $TOKEN"
```

### Get Access Logs (JSON)
```bash
curl "https://defcomm.gateway/api/drive/shares/1/logs?per_page=50" \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "drive_share_id": 1,
      "ip_address": "192.168.1.1",
      "browser": "Chrome",
      "os": "macOS",
      "device": "Desktop",
      "country_code": "US",
      "city": "New York",
      "created_at": "2026-07-16T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 42,
    "per_page": 50,
    "current_page": 1,
    "last_page": 1
  }
}
```

---

## OAuth2 Integration

### Start OAuth2 Flow
```
GET /auth/authorize?client_id=CLIENT_ID&redirect_uri=CALLBACK&scope=read+write&state=RANDOM
```

### Exchange Code for Token
```bash
curl -X POST https://defcomm.gateway/api/central-auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "CODE",
    "client_id": "CLIENT_ID",
    "client_secret": "CLIENT_SECRET",
    "redirect_uri": "CALLBACK"
  }'
```

### Refresh Access Token
```bash
curl -X POST https://defcomm.gateway/api/central-auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "REFRESH_TOKEN",
    "client_id": "CLIENT_ID",
    "client_secret": "CLIENT_SECRET"
  }'
```

---

## API Token Integration

### Create API Token (User)
```bash
curl -X POST https://defcomm.gateway/api/central-auth/api-tokens \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Service",
    "scopes": ["read", "write"],
    "expires_in_days": 365
  }'
```

Response:
```json
{
  "data": {
    "id": 1,
    "name": "My Service",
    "scopes": ["read", "write"],
    "last_used_at": null,
    "expires_at": "2027-07-16T00:00:00Z",
    "is_active": true,
    "created_at": "2026-07-16T00:00:00Z"
  },
  "token": "token_abc123..."
}
```

### Verify API Token
```bash
curl https://defcomm.gateway/api/central-auth/verify-token \
  -H "Authorization: Bearer token_abc123..."
```

Response:
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

### Get User Profile
```bash
curl https://defcomm.gateway/api/central-auth/me \
  -H "Authorization: Bearer token_abc123..."
```

### List API Tokens
```bash
curl https://defcomm.gateway/api/central-auth/api-tokens \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Revoke API Token
```bash
curl -X DELETE https://defcomm.gateway/api/central-auth/api-tokens/1 \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Code Examples

### Python - Create & Use API Token

```python
import requests
import json

# 1. Create token
response = requests.post(
    'https://defcomm.gateway/api/central-auth/api-tokens',
    headers={'Authorization': f'Bearer {user_token}'},
    json={
        'name': 'Python Bot',
        'scopes': ['read'],
        'expires_in_days': 90,
    }
)

token_data = response.json()
api_token = token_data['token']

# 2. Use token to verify
verify_response = requests.get(
    'https://defcomm.gateway/api/central-auth/verify-token',
    headers={'Authorization': f'Bearer {api_token}'}
)

print(verify_response.json())

# 3. Get user profile
me_response = requests.get(
    'https://defcomm.gateway/api/central-auth/me',
    headers={'Authorization': f'Bearer {api_token}'}
)

print(me_response.json())
```

### Node.js - OAuth2 Flow

```javascript
const express = require('express');
const axios = require('axios');
const app = express();

const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';
const REDIRECT_URI = 'http://localhost:3000/callback';
const AUTH_SERVER = 'https://defcomm.gateway';

// 1. Redirect to authorization
app.get('/login', (req, res) => {
  const state = Math.random().toString(36).substring(7);
  req.session.state = state;
  
  const authUrl = `${AUTH_SERVER}/auth/authorize?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `scope=read+write&` +
    `state=${state}`;
  
  res.redirect(authUrl);
});

// 2. Handle callback
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Verify state
  if (state !== req.session.state) {
    return res.status(400).send('State mismatch');
  }
  
  try {
    // Exchange code for token
    const response = await axios.post(
      `${AUTH_SERVER}/api/central-auth/token`,
      {
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }
    );
    
    const { access_token, refresh_token } = response.data;
    
    // Store tokens securely (e.g., HttpOnly cookie, Redis, etc.)
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;
    
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).send('Token exchange failed');
  }
});

// 3. Use token
app.get('/dashboard', async (req, res) => {
  try {
    const response = await axios.get(
      `${AUTH_SERVER}/api/central-auth/me`,
      {
        headers: {
          Authorization: `Bearer ${req.session.accessToken}`,
        },
      }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(401).send('Unauthorized');
  }
});

app.listen(3000);
```

### PHP - API Token Usage

```php
<?php

$API_TOKEN = 'token_abc123...';
$API_URL = 'https://defcomm.gateway/api/central-auth';

// 1. Verify token
$ch = curl_init("$API_URL/verify-token");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $API_TOKEN"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$data = json_decode($response, true);

if ($data['valid']) {
    echo "Token is valid!";
    echo "User: " . $data['user']['name'];
    echo "Email: " . $data['user']['email'];
}

curl_close($ch);

// 2. Get user profile
$ch = curl_init("$API_URL/me");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $API_TOKEN"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
$user = json_decode($response, true);

print_r($user);

curl_close($ch);
?>
```

---

## Common Issues & Solutions

### Issue: "Invalid redirect URI"
**Solution:** Ensure the redirect_uri in request matches exactly what's registered for the OAuth2 client (including scheme, domain, path)

### Issue: "Authorization code expired"
**Solution:** Authorization codes expire after 10 minutes. Start the OAuth2 flow again

### Issue: "Invalid client secret"
**Solution:** Ensure the client_secret is correct and matches what's in the database (remember it should be hashed with `hash('sha256', ...)`)

### Issue: Token returns 401
**Solution:** 
- Check if token is valid: `GET /api/central-auth/verify-token`
- Check if token has expired: `expires_at` should be in future
- Check if token is active: `is_active` should be true
- Check if token has been revoked

---

## Monitoring & Debugging

### List All API Tokens for User
```bash
curl https://defcomm.gateway/api/central-auth/api-tokens \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Check Token Usage History
Look at `last_used_at` field in api_tokens table to see when token was last used

### Monitor Access Logs
```sql
SELECT * FROM access_logs 
WHERE drive_share_id = 1 
ORDER BY created_at DESC;
```

### Query OAuth2 Clients
```sql
SELECT * FROM oauth_clients WHERE is_active = true;
```

### Query Active Access Tokens
```sql
SELECT * FROM oauth_access_tokens 
WHERE expires_at > NOW() 
ORDER BY created_at DESC;
```

---

**For detailed documentation:** See `docs/CENTRALIZED_AUTH.md`
