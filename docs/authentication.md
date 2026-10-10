# Authentication, authorization & audit (AAA)

[← README](../README.md) · [Docs index](README.md)

FreqHub ships JWT auth, RBAC, bot ownership, and audit logging.

## Roles

| Role | Access |
|------|--------|
| **Superadmin** | Full access |
| **Auditor** | Read-only (no sensitive credentials) |
| **User** | Owned bots only |

## Auth endpoints

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`

All `/api/bots/*` routes require authentication. Ownership is enforced on mutate/view (superadmin/auditor see all).

## Audit

Actions are logged (data change / access / system / auth). Passwords and tokens are redacted.

- `GET /api/audit` — filtered logs (superadmin/auditor)
- `GET /api/audit/resource/:resourceType/:resourceId` — resource history

## User management (superadmin)

- CRUD: `GET/POST /api/users`, `GET/PUT/DELETE /api/users/:id`
- Bots: `POST/DELETE /api/users/:id/bots/:botId`, `GET /api/users/:id/bots`

## Default superadmin

On first start (no superadmin), credentials are created and printed **once** in server logs:

- Username: `freqhub` (`DEFAULT_ADMIN_USERNAME`)
- Email: `admin@freqhub.local` (`DEFAULT_ADMIN_EMAIL`)
- Password: random 16+ chars

Copy immediately, change password after first login, store securely.

## Frontend

Login-first lazy load, JWT in requests, protected routes, user management UI for superadmin.

## Planned

- 2FA (TOTP), QR auth, richer session management
- Audit log viewer in the UI

Swagger: `http://localhost:3001/api-docs`

<p align="right"><a href="#authentication-authorization--audit-aaa">⬆ back to top</a></p>
