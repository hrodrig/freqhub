# Changelog

All notable changes to FreqHub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.4] - 2026-01-11

### Added
- User profile page accessible from navigation username
- Display name (`name`) field for users (migration 007)
- `PUT /api/auth/profile` endpoint for users to update their own profile (name and password)
- User Management page for superadmins to manage users and bot assignments
- Display name shown in user list with username fallback

### Changed
- Navigation now shows display name (or username if no display name) and links to profile page
- User profile page replaces separate "Change Password" page
- Iconography made consistent across all pages (Settings, User, Lock, Shield, CheckCircle2, XCircle, Loader2, Eye, EyeOff)

### Fixed
- Fixed TypeScript error in `UserManagement.tsx` for `name` field type handling
- Fixed `updateUser` function to not attempt updating non-existent `updated_by` column

### Removed
- `ChangePassword.tsx` page (functionality moved to Profile page)

## [0.2.0] - 2025-12-XX

### Added
- Complete Authentication, Authorization, and Audit (AAA) system
- Multi-user support with role-based access control (RBAC)
  - Roles: `superadmin`, `auditor`, `user`
  - Superadmin: full control over all resources
  - Auditor: read-only access to all data (with sensitive data redacted)
  - User: full control over assigned bots only
- Comprehensive audit logging with username identification
- Frontend authentication and login page
- User management API (superadmin only)
- Automatic superadmin initialization on first startup
- JWT-based authentication
- Protected routes and API endpoints
- Bot ownership system
- Audit log viewing (superadmin and auditor)

### Changed
- All API endpoints now require authentication
- Bot access filtered by user role and ownership
- Sensitive data (passwords, tokens) redacted for auditor role

## [0.1.0] - 2025-XX-XX

### Added
- Initial release
- Multi-bot dashboard for Freqtrade
- WebSocket support for real-time updates
- Bot management (create, edit, delete, start, stop, pause)
- Dashboard with bot status and metrics
- Proxy API to Freqtrade REST API
- Caching with Valkey (Redis-compatible)
- Automatic polling service
- Rate limiting for API protection

[Unreleased]: https://github.com/hrodrig/freqhub/compare/v0.2.4...HEAD
[0.2.4]: https://github.com/hrodrig/freqhub/compare/v0.2.0...v0.2.4
[0.2.0]: https://github.com/hrodrig/freqhub/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hrodrig/freqhub/releases/tag/v0.1.0
