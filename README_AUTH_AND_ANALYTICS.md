# Defcomm Gateway - File Analytics & Centralized Auth

## 📋 Overview

This release adds two major features to enhance file sharing security and enable centralized authentication for external integrations:

1. **File Viewer Analytics** - Track detailed statistics about who accessed shared files
2. **Centralized Authentication** - OAuth2 and API token-based auth for external services

---

## 🚀 Quick Start

### Deploy
```bash
php artisan migrate
php artisan cache:clear
```

### Access Analytics
- Share a file
- Navigate to `/drive/shares/{shareId}/analytics`

### Create API Token
```bash
# As authenticated user
curl -X POST /api/central-auth/api-tokens \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"My App","scopes":["read"]}'
```

---

## 📚 Documentation

### For Development Teams
1. **[SETUP_DEPLOYMENT.md](./SETUP_DEPLOYMENT.md)** - Installation and configuration
2. **[CENTRALIZED_AUTH.md](./docs/CENTRALIZED_AUTH.md)** - Complete OAuth2 & API token guide
3. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - API endpoints and code examples

### For Project Managers
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - What was built and why

---

## ✨ Features

### File Analytics
- ✅ Track individual file access events
- ✅ Capture browser, OS, device information
- ✅ Geolocation tracking (city, country)
- ✅ Access statistics dashboard
- ✅ Detailed access logs with pagination
- ✅ Automatic access logging on file views

### Authentication System

#### OAuth2
- ✅ Authorization Code flow
- ✅ Access + refresh tokens
- ✅ Token expiration (configurable)
- ✅ Scope-based permissions
- ✅ State parameter for CSRF protection
- ✅ User consent workflows

#### API Tokens
- ✅ Simple bearer token auth
- ✅ Scope management (read, write, admin)
- ✅ Optional expiration dates
- ✅ Usage tracking
- ✅ Easy revocation
- ✅ Per-service token isolation

---

## 🔧 What Was Added

### New Files
```
✓ app/Services/Auth/CentralizedAuthService.php
✓ app/Models/AccessLog.php
✓ app/Models/ApiToken.php
✓ app/Http/Controllers/Auth/CentralizedAuthController.php
✓ app/Http/Middleware/ApiTokenAuth.php
✓ resources/js/pages/drive/share-analytics.tsx
✓ database/migrations/2026_07_16_000001_create_access_logs_table.php
✓ database/migrations/2026_07_16_000002_create_oauth_tables.php
✓ database/migrations/2026_07_16_000003_create_api_tokens_table.php
✓ docs/CENTRALIZED_AUTH.md
✓ IMPLEMENTATION_SUMMARY.md
✓ QUICK_REFERENCE.md
✓ SETUP_DEPLOYMENT.md
```

### Modified Files
```
✓ app/Models/DriveShare.php (added analytics methods)
✓ app/Http/Controllers/DriveController.php (added analytics endpoints)
✓ routes/web.php (added OAuth2 routes)
✓ routes/api.php (added auth endpoints)
```

---

## 📊 Database Schema

### New Tables
- `access_logs` - File access events
- `oauth_clients` - External service registrations
- `oauth_auth_codes` - Authorization codes
- `oauth_access_tokens` - OAuth2 tokens
- `oauth_refresh_tokens` - Refresh tokens
- `api_tokens` - Service API tokens

---

## 🔌 API Endpoints

### File Analytics
- `GET /drive/shares/{share}/analytics` - View analytics page
- `GET /api/drive/shares/{share}/logs` - Get access logs (JSON)

### OAuth2
- `GET /auth/authorize` - Start authorization flow
- `POST /auth/authorize` - Process user approval
- `POST /api/central-auth/token` - Exchange code for token

### API Tokens
- `POST /api/central-auth/api-tokens` - Create token
- `GET /api/central-auth/api-tokens` - List tokens
- `DELETE /api/central-auth/api-tokens/{id}` - Revoke token

### Public Verification
- `GET /api/central-auth/verify-token` - Verify API token
- `GET /api/central-auth/verify-oauth` - Verify OAuth token
- `GET /api/central-auth/me` - Get user profile

---

## 🔐 Security Features

- **Hashed Token Storage** - All tokens are hashed before storage
- **CSRF Protection** - State parameter in OAuth2
- **Scope Validation** - Fine-grained permission control
- **Token Expiration** - Configurable TTL for tokens
- **Usage Tracking** - Monitor when tokens are used
- **Easy Revocation** - Instantly disable compromised tokens

---

## 🎯 Use Cases

### For Internal Use
- Track file access patterns
- Identify popular documents
- Monitor share security
- Understand user behavior

### For External Services
- Authenticate via OAuth2 for user-facing apps
- Use API tokens for backend services
- Implement SSO across Defcomm ecosystem
- Secure microservices communication

---

## 📈 Next Steps

1. **Deploy migrations**
   ```bash
   php artisan migrate
   ```

2. **Register external services** (if applicable)
   - Create OAuth2 clients in database
   - Generate client secrets

3. **Test the system**
   - Create shared files
   - View analytics
   - Create and test API tokens

4. **Monitor usage**
   - Check access logs
   - Review token usage
   - Track auth events

---

## ⚠️ Important Notes

- OAuth2 authorization codes expire after 10 minutes
- Access tokens expire after 1 hour
- Refresh tokens expire after 30 days
- API tokens are returned only once during creation
- All tokens are stored hashed in the database
- Client secrets should be stored securely

---

## 📞 Support Resources

- **Issues?** See `SETUP_DEPLOYMENT.md` troubleshooting section
- **Integration help?** Check `QUICK_REFERENCE.md` for code examples
- **Detailed docs?** Read `CENTRALIZED_AUTH.md`
- **What changed?** See `IMPLEMENTATION_SUMMARY.md`

---

## 🎓 Learning Path

**For Developers:**
1. Start with `QUICK_REFERENCE.md` for API overview
2. Read `CENTRALIZED_AUTH.md` for detailed flows
3. Follow `SETUP_DEPLOYMENT.md` for setup
4. Review code examples for your language

**For DevOps/Admins:**
1. Follow `SETUP_DEPLOYMENT.md`
2. Configure OAuth2 clients
3. Set up monitoring
4. Configure backup/recovery

**For Project Managers:**
1. Read `IMPLEMENTATION_SUMMARY.md`
2. Understand use cases
3. Plan external service integrations
4. Set up testing procedures

---

## 🔄 Integration Path with USER_API

The centralized auth system is designed to work alongside your existing `USER_API` at `https://backend.defcomm.ng/api`:

```
┌─────────────────────┐
│  External Services  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────┐
│  Centralized Auth (Gateway)     │
│  - OAuth2                       │
│  - API Tokens                   │
└──────────┬──────────────────────┘
           │
           ↓
┌─────────────────────────────────┐
│  USER_API (backend.defcomm.ng)  │
│  - User validation              │
│  - Profile sync                 │
└─────────────────────────────────┘
```

---

## ✅ Checklist Before Going Live

- [ ] All migrations have been run
- [ ] OAuth2 clients have been registered
- [ ] API token system has been tested
- [ ] File analytics is working
- [ ] Database backups are configured
- [ ] Logging is enabled
- [ ] Error handling is tested
- [ ] Performance testing completed
- [ ] Security review completed
- [ ] Documentation is updated

---

**Release Date:** July 16, 2026  
**Version:** 1.0  
**Status:** Ready for Deployment  

For questions or issues, refer to the documentation files or contact your development team.
