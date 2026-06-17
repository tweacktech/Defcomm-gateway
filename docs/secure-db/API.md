# Secure DB — API Documentation

Base URL: `/api/secure-db`

## Authentication

All endpoints require project API credentials via headers:

```
X-Secure-DB-Key: {api_key}
X-Secure-DB-Secret: {secret_key}
```

Optional IP restrictions are enforced per project when `allowed_ips` is configured.

Rate limiting: default 60 requests/minute per IP per project.

## Endpoints

### POST /encrypt

Encrypt a string value.

**Request:**
```json
{ "value": "plaintext", "algorithm": "aes-256-gcm" }
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "encrypted": "...",
    "algorithm": "aes-256-gcm",
    "key_version": "1"
  }
}
```

### POST /decrypt

Decrypt an encrypted value. Requires device authorization when configured.

**Request:**
```json
{ "value": "...", "algorithm": "aes-256-gcm" }
```

### POST /rotate

Queue a key rotation job for the project.

### GET /status

Returns project status, connection health, and system monitoring metrics.

## Webhooks

Configure webhooks per project for events:
- `encryption.completed`
- `rotation.completed`
- `connection.lost`
- `unauthorized.access`

Deliveries retry up to `max_retries` with exponential backoff.

## Error Codes

| Code | Meaning |
|------|---------|
| 401 | Invalid or missing credentials |
| 403 | IP not allowed |
| 429 | Rate limit exceeded |
