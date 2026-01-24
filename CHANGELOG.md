/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

# Changelog

All notable changes to FreqHub will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.10] - 2026-01-24

### Added
- Production hardening for bot URLs with SSRF safeguards (blocks localhost/private targets in prod)
- Swagger toggle (`SWAGGER_ENABLED`) and production defaults
- Bootstrap admin and auth lockout configuration
- Nginx security hardening (rate limit, security headers, dotfile deny, static cache)
- WebSocket auth token support on the frontend
- Timestamped logs across backend + frontend

### Changed
- Health detail endpoints restricted to `superadmin`/`auditor` in production
- Placeholder secrets rejected in production configs

## [0.2.8] - 2026-01-17

### Added

#### BotCommandChat Component (New)
- Complete Telegram-like command interface (`frontend/src/components/BotCommandChat.tsx`)
- Chat-style UI with user messages (blue) and bot responses (gray)
- Timestamps on each message with color differentiation
- Auto-scroll to bottom of chat
- Input field maintains text after sending commands for easy re-submission
- Auto-focus on input field after sending commands or clicking quick buttons
- Quick command buttons with hover tooltips showing command descriptions
- Hover effects on quick command buttons (background color change)
- Integrated in BotDetail page with fixed 600px height

#### Command Support (40+ commands)
**Bot Control Commands:**
- `/start`, `/stop`, `/pause`, `/reload_config` - Multi-stage status updates (initial, intermediate, final)
- `/stopentry`, `/forceexit`, `/fx` - With parameter validation
- `/delete <trade_id>` - Uses DELETE /api/v1/trades/{tradeId}
- `/reload_trade <trade_id>` - Reloads trade from exchange
- `/cancel_open_order <trade_id>`, `/coo <trade_id>` - Uses DELETE /api/v1/trades/{tradeId}/open-order
- `/blacklist_delete <pairs>`, `/bl_delete <pairs>` - Uses DELETE /api/v1/blacklist with query parameters
- `/unlock <pair|id>` - Without parameters shows current locks, with parameters unlocks

**Current State Commands:**
- `/show_config` - Full configuration format
- `/balance`, `/balance total` - Detailed format with currency table for `/balance total`
- `/locks` - Formatted table of active locks
- `/health` - Formatted timestamp and bot state
- `/count` - Formatted table of active trades
- `/logs [limit]` - List of recent logs
- `/version` - Format "Version: X.X.X"
- `/whitelist` - Format "Using whitelist ['StaticPairList'] with X pairs"
- `/blacklist` - Format "Blacklist contains X pairs"

**Statistics Commands:**
- `/status`, `/status table` - Detailed Telegram-like format, table with two total lines
- `/profit`, `/profit_long`, `/profit_short [n]` - Complete profit statistics
- `/trades [limit]` - Formatted table of closed trades
- `/daily [n]`, `/weekly [n]`, `/monthly [n]` - Formatted tables with aligned columns
- `/stats` - Table of wins/losses with average durations, aligned columns
- `/performance` - Performance list by pair
- `/entries <pair|none>`, `/exits <pair|none>`, `/mix_tags <pair|none>` - Formatted lists
- `/marketdir [direction]` - Updates market direction
- `/list_custom_data <trade_id> [key]` - Lists custom data

**Help:**
- `/help` - Complete message with clickable commands (execute base command)
- Improved regex to prevent trading pairs from being clickable

#### Formatting Functions
- `formatProfit`: Handles profit_closed, profit_all, winrate, expectancy, drawdown
- `formatStatusList`: Detailed list of open trades with profit, relative dates
- `formatStatusTable`: ASCII table with aligned columns, two total lines
- `formatBalance`: Detailed balance with starting capital, currencies, estimated value
- `formatCount`: Table of active trades vs maximum allowed
- `formatDaily`, `formatWeekly`, `formatMonthly`: Tables with aligned columns
- `formatStats`: Table of wins/losses by exit reason with durations
- `formatTrades`: Table of closed trades with complete details
- `formatEntries`, `formatExits`, `formatMixTags`: Formatted lists
- `formatHealth`: Formatted timestamp of last process
- `formatLocks`: Table of active locks
- `formatBlacklist`, `formatWhitelist`: Formatted messages with count
- `formatVersion`: "Version: X.X.X"
- `formatShowConfig`: Complete bot configuration

#### Dashboard Enhancements
- Win Rate column added after P&L column
- Win Rate obtained from `/api/v1/profit` endpoint (winrate field)
- Win Rate updates automatically via WebSocket
- BotStatus interface extended with winrate field
- Event handler `bot_profit_update` updated to include winrate
- Real-time updates confirmed: Dashboard shows changes when bots open/close trades
  - Maximum delay of 10 seconds (configurable with POLLING_INTERVAL)
  - Automatic WebSocket updates for: trade count, P&L, open trades list, Win Rate

#### Bot Detail Page Improvements
- Currencies section changed from list to table format
- New table with columns: Token | Free | Used | Total
- Improved readability and easier value comparison
- Responsive design with horizontal scroll if needed

#### Infrastructure
- Cross-platform bash script `freqhub` (replaces Makefile)
  - Compatible with Linux, macOS, Windows (Git Bash/WSL)
  - Commands: setup, build, start, stop, restart, logs, clean, test, help
- Updated all Docker Compose commands to V2 syntax (`docker compose` instead of `docker-compose`)

### Changed

#### UI/UX Improvements
- Different colors for user messages (bg-blue-500) and bot messages (bg-gray-700)
- User and bot icons in messages
- Timestamps with differentiated colors
- Clickable commands in `/help` execute base command and populate input field
- Enhanced hover effects on quick command buttons

#### Backend Improvements
- **Proxy Service** (`backend/src/services/proxyService.ts`):
  - Path normalization: removes leading slash before passing to axios to prevent malformed URLs
  - Enhanced network error handling with specific messages
  - Improved 502 Bad Gateway error parsing to extract Freqtrade messages
  - Enhanced logging for debugging proxy requests
  - Better handling of "Error querying..." errors with underlying message extraction
- **Proxy Routes** (`backend/src/routes/proxy.ts`):
  - Additional logging for DELETE requests

#### Documentation
- Environment file references updated from `.env.example` to `env.example` (no leading dot)
- Explicit recommendation to use environment variables for sensitive credentials
- Preference for environment variables over `.env` files for production
- Updated files: README.md, ENV_SETUP.md, examples/docker/README.md, examples/docker/setup.sh, scripts/setup-test-env.sh

#### Dashboard
- Removed UUID display under bot name in Strategy column
- Added Win Rate column after P&L column

#### Command Formatting
- Format adjustments to exactly match Telegram:
  - `/status table`: Two total lines with specific format
  - `/weekly`: Title "Weekly Profit over the last X weeks (starting from Monday):"
  - `/weekly`: Headers "Monday (count) USDT USD Profit %" with correct spacing
  - `/stats`: Precise alignment of "Avg. Duration" column with data
  - `/version`: Exact format "Version: X.X.X"
  - `/help`: Blank lines visible in message

### Fixed

#### HTTP Methods and Endpoints
- `/blacklist_delete`: Changed from POST to DELETE /api/v1/blacklist?pairs_to_delete=...
- `/cancel_open_order`, `/coo`: Changed to DELETE /api/v1/trades/{tradeId}/open-order
- `/delete`: Changed to DELETE /api/v1/trades/{tradeId}
- `/reload_trade`: Added trade_id validation (required)

#### Error Handling
- Path normalization in proxy service to prevent malformed URLs
- Error messages now include trade_id when available for better debugging
- Enhanced error extraction from Freqtrade responses (detail, message, error fields)
- Specific handling for network errors (ECONNRESET, ETIMEDOUT, socket hang up, Network Error)
- Better 502 Bad Gateway error parsing to extract underlying Freqtrade messages

#### Command Behavior
- `/forceexit` and `/fx` without parameters now show list of open trades (like Telegram)
- `/unlock` without parameters shows current locks, with invalid ID shows "No active locks"
- Regex in `/help` message fixed to prevent trading pairs from being clickable

### Removed
- Makefile (replaced with `freqhub` bash script)

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

[Unreleased]: https://github.com/hrodrig/freqhub/compare/v0.2.8...HEAD
[0.2.8]: https://github.com/hrodrig/freqhub/compare/v0.2.4...v0.2.8
[0.2.4]: https://github.com/hrodrig/freqhub/compare/v0.2.0...v0.2.4
[0.2.0]: https://github.com/hrodrig/freqhub/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/hrodrig/freqhub/releases/tag/v0.1.0
