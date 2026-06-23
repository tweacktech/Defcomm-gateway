# Secure DB — Admin Guide

## Access

Navigate to **Security → Secure DB** in the sidebar, or visit `/admin/secure-db`.

Admin role (`users.role = admin`) is required for all Secure DB pages.

## Dashboard

View real-time metrics:
- Active projects and connections
- Encrypted record counts
- Key rotations and device activity
- System health (CPU, memory, queue, database)
- Recent audit events

## Projects

Create projects with:
- Name, description, owner
- Environment (development/staging/production)
- Encryption mode (field/row/collection/document)
- Rotation interval

Each project receives an API key and secret key on creation. **Save the secret immediately** — it is not shown again.

### Project Statuses
- **Active** — full operation
- **Paused** — encryption disabled
- **Suspended** — access restricted
- **Archived** — read-only, hidden from active lists

## Connections

Add external databases (MySQL, PostgreSQL, SQL Server, MariaDB, MongoDB, Redis).

Credentials are encrypted at rest. Use **Test Connection** to verify connectivity.

## Policies

Define which tables/collections and fields require encryption, and which algorithm to use.

## Keys

View all encryption keys. Trigger manual rotation or revoke compromised keys.

## Devices

Approve, revoke, or block devices that request decryption access.

## Audit Logs

Full immutable audit trail. Export as CSV, Excel, or PDF.

## Reports

Generate encryption, decryption, device, audit, and compliance reports per project.

## Settings

Configure global defaults:
- Default encryption algorithm
- Rotation frequency
- Data and audit retention periods
- Notification channels (email, SMS, in-app)
