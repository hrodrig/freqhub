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

# Database Directory

This directory contains SQLite database files for FreqHub.

## Files

- **`freqhub.db.example`** - Example database with sample bots (included in repository)
- **`freqhub.db`** - Your local development database (gitignored, not in repository)

## Getting Started

### Option 1: Use the Example Database

If you just cloned the repository and want to get started quickly:

```bash
# Copy the example database to create your local database
cp data/freqhub.db.example data/freqhub.db
```

**Note:** The example database uses a default encryption key. For production, you should:
1. Set your own `ENCRYPTION_KEY` in `.env` (minimum 32 characters)
2. Update the bot credentials in the database via the API or manually

### Option 2: Start Fresh

If you prefer to start with an empty database:

```bash
# Just start the backend - it will create an empty database automatically
npm run dev
```

The database will be created automatically on first run with the schema initialized.

## Example Database Contents

The `freqhub.db.example` includes 3 example bots:

1. **Freqtrade Bot 1** - `http://localhost:8080` (Enabled)
2. **Freqtrade Bot 2** - `http://localhost:8081` (Enabled)
3. **Freqtrade Bot 3** - `http://localhost:8082` (Disabled)

**Default credentials:**
- Username: `freqtrader`
- Passwords: `SuperSecret1!`, `SuperSecret2!`, `SuperSecret3!` (respectively)

⚠️ **Important:** These are placeholder credentials. Update them with your actual Freqtrade API credentials after cloning.

## Regenerating the Example Database

If you need to regenerate the example database:

```bash
npm run db:example
```

This will recreate `freqhub.db.example` with fresh sample data.

## Database Schema

The database contains a single `bots` table with the following structure:

- `id` - UUID (Primary Key)
- `name` - Bot display name
- `api_url` - Freqtrade API URL
- `ws_url` - WebSocket URL (optional)
- `username` - Freqtrade API username
- `encrypted_password` - Encrypted password (AES-256-CBC)
- `access_token` - JWT token (cached, optional)
- `token_expires_at` - Token expiration timestamp
- `is_enabled` - Whether the bot is enabled (1 = true, 0 = false)
- `is_selected` - Whether the bot is selected (1 = true, 0 = false)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

## Security Notes

- **Development:** The example database uses a default encryption key for convenience
- **Production:** Always set a strong, unique `ENCRYPTION_KEY` in your `.env` file
- **Backup:** Consider backing up your `freqhub.db` file regularly
- **Git:** Your local `freqhub.db` is gitignored and will never be committed to the repository

