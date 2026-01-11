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

# Environment Configuration Guide

## ⚖️ Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

**Trading cryptocurrencies involves substantial risk of loss and is not suitable for every investor.** The value of cryptocurrencies may fluctuate, and you may lose some or all of your investment. Past performance is not indicative of future results. You should carefully consider whether trading cryptocurrencies is suitable for you in light of your circumstances, knowledge, and financial resources.

By using this software, you acknowledge that:
- You understand the risks involved in cryptocurrency trading
- You are solely responsible for any trading decisions made
- The authors and contributors are not responsible for any financial losses
- You will not hold the authors liable for any damages arising from the use of this software

## Important: Encryption Key Consistency

**CRITICAL**: The `ENCRYPTION_KEY` must be the **SAME** in both local development and Docker Compose environments. This ensures that bot passwords encrypted in one environment can be decrypted in the other.

## Setup

1. **Create a `.env` file** in the project root (copy from example below):

```bash
# Encryption Key (MUST be at least 32 characters)
# IMPORTANT: Use the SAME key in both local development and Docker Compose
ENCRYPTION_KEY=example-encryption-key-min-32-chars-for-demo

# JWT Secret (MUST be at least 32 characters)
JWT_SECRET=change-this-jwt-secret-in-production-min-32-chars-long

# Database Path (for local development)
DATABASE_PATH=./backend/data/freqhub.db

# Backend Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info

# Valkey/Redis Configuration (optional)
VALKEY_ENABLED=false
VALKEY_HOST=localhost
VALKEY_PORT=6379
VALKEY_PASSWORD=

# Base Path (for subdirectory deployments)
BASE_PATH=/
```

2. **For Docker Compose**: The compose files will automatically use the `ENCRYPTION_KEY` from your `.env` file if it exists, or fall back to the default value.

3. **For Local Development**: The backend will automatically load the `.env` file from the project root.

## Default Values

If no `.env` file exists, the following defaults are used:

- `ENCRYPTION_KEY`: `example-encryption-key-min-32-chars-for-demo`
- `JWT_SECRET`: `change-this-jwt-secret-in-production-min-32-chars-long`

**Note**: These defaults are for development only. In production, you MUST set secure, unique values.

## Migration Between Environments

If you have existing bots with encrypted passwords:

1. **Option 1 (Recommended)**: Update bot passwords in the frontend (Bot Management) to re-encrypt them with the current key.

2. **Option 2**: Use the same `ENCRYPTION_KEY` that was used when the passwords were originally encrypted.

## Security Notes

- Never commit your `.env` file to version control
- Use strong, unique encryption keys in production
- Rotate encryption keys periodically (requires re-encrypting all bot passwords)
