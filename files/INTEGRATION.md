# Integrating with Defcomm Centralized Auth

Three ways another service can use this, depending on what it needs.

## 1. Verify a token a user brought with them

Call this on any request carrying a Defcomm token, from any language:

```
GET /auth/verify-token          (for API tokens, prefix dct_)
GET /auth/verify-oauth-token    (for OAuth2 access tokens)
Authorization: Bearer <token>
```

```bash
curl https://defcomm.example.com/auth/verify-token \
  -H "Authorization: Bearer dct_xxx"
```

Returns `{ "valid": true, "user": {...}, "scopes": [...] }` or a 401.

## 2. Pull-sync users (good for a startup backfill or periodic reconcile)

Requires an API token created with the `admin` scope
(`POST /auth/api-tokens` with `"scopes": ["admin"]`).

```
GET /auth/users/sync?since=2026-07-01T00:00:00Z&limit=100&cursor=<opaque>
Authorization: Bearer <admin-scoped token>
```

Page through with the returned `next_cursor` until `has_more` is `false`.

## 3. Webhooks (real-time push on create/update/delete)

Register an endpoint once:

```
POST /auth/webhooks
Authorization: (session auth, from the Defcomm dashboard)
{
  "name": "Billing Service",
  "url": "https://billing.example.com/hooks/defcomm",
  "events": ["user.created", "user.updated", "user.deleted"]
}
```

The response includes a `secret` — **shown once**, store it. Every delivery
to your `url` is a signed POST:

```
POST <your url>
X-Defcomm-Event: user.updated
X-Defcomm-Delivery: <uuid>
X-Defcomm-Signature: sha256=<hex hmac>

{"event":"user.updated","delivery_id":"...","created_at":"...","data":{...}}
```

Verify the signature over the **raw request body** before trusting it, in
whatever language your service runs. Two examples:

**Node.js**
```js
const crypto = require('crypto');

function isValid(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}
```

**PHP**
```php
function isValid(string $rawBody, string $signatureHeader, string $secret): bool
{
    $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);
    return hash_equals($expected, $signatureHeader);
}
```

Any language with HMAC-SHA256 support works the same way — sign the exact
raw bytes you received, compare with a constant-time comparison.

Failed deliveries retry 5 times with backoff (10s, 30s, 2m, 10m, 1h). After
10 consecutive failures the subscription is auto-disabled; re-enable it by
rotating the secret (`POST /auth/webhooks/{id}/rotate-secret`).
