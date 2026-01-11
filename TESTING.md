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

# Complete Stack Testing Guide

This guide will help you set up and test the complete FreqHub stack with multiple Freqtrade instances.

## ⚖️ Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

**Trading cryptocurrencies involves substantial risk of loss and is not suitable for every investor.** The value of cryptocurrencies may fluctuate, and you may lose some or all of your investment. Past performance is not indicative of future results. You should carefully consider whether trading cryptocurrencies is suitable for you in light of your circumstances, knowledge, and financial resources.

By using this software, you acknowledge that:
- You understand the risks involved in cryptocurrency trading
- You are solely responsible for any trading decisions made
- The authors and contributors are not responsible for any financial losses
- You will not hold the authors liable for any damages arising from the use of this software

## Prerequisites

- Docker and Docker Compose installed
- At least 4GB of RAM available
- Free ports: 3000, 3001, 8080, 8081, 8082

## Initial Setup

### 1. Prepare the Environment

Run the setup script that will create the necessary directories and verify prerequisites:

```bash
cd freqhub
./scripts/setup-test-env.sh
```

This script:
- Verifies that Docker is installed and running
- Creates necessary data directories
- Copies Freqtrade configurations
- Verifies port availability
- Creates .env files if they don't exist

### 2. Configure Environment Variables

If the script didn't create the .env files automatically, create them manually:

**Project root (`freqhub/.env`):**
```env
NODE_ENV=development
PORT=3001
DATABASE_PATH=./backend/data/freqhub.db
ENCRYPTION_KEY=change-this-encryption-key-min-32-characters-long-please
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
BASE_PATH=/
VITE_API_PROXY_TARGET=http://localhost:3001
FREQTRADE_USERNAME=freqtrader
FREQTRADE_PASSWORD_1=SuperSecret1!
FREQTRADE_PASSWORD_2=SuperSecret2!
FREQTRADE_PASSWORD_3=SuperSecret3!
FREQTRADE_JWT_SECRET=change-this-jwt-secret-key-in-production-min-32-chars
```

**Backend (`freqhub/backend/.env`):**
```env
PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/freqhub.db
ENCRYPTION_KEY=change-this-encryption-key-min-32-characters-long-please
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
```

**Frontend (`freqhub/frontend/.env`):**
```env
BASE_PATH=/
VITE_API_PROXY_TARGET=http://localhost:3001
```

⚠️ **Important**: Change `ENCRYPTION_KEY` and `FREQTRADE_JWT_SECRET` to secure values in production.

## Start the Complete Stack

### Option 1: Docker Compose (Recommended)

```bash
cd freqhub
docker-compose -f docker-compose.full.yml up -d
```

This will start:
- **FreqHub Backend** at `http://localhost:3001`
- **FreqHub Frontend** at `http://localhost:3000`
- **Freqtrade Instance 1** at `http://localhost:8080`
- **Freqtrade Instance 2** at `http://localhost:8081`
- **Freqtrade Instance 3** at `http://localhost:8082`

### Option 2: Local Development

If you prefer to develop locally without Docker:

**Terminal 1 - Backend:**
```bash
cd freqhub/backend
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd freqhub/frontend
npm install
npm run dev
```

**Terminal 3 - Freqtrade (Docker):**
```bash
cd examples/docker
docker-compose up -d
```

## Verify Everything Works

### 1. Verify Services with Script

Run the connectivity test script:

```bash
cd freqhub
./scripts/test-connection.sh
```

This script verifies:
- ✅ FreqHub Backend responds
- ✅ FreqHub Frontend responds
- ✅ All Freqtrade instances respond
- ✅ Authentication works
- ✅ Connectivity between Docker services

### 2. Manual Verification

**Backend Health Check:**
```bash
curl http://localhost:3001/api/healthz
```

**Freqtrade Ping:**
```bash
curl http://localhost:8080/api/v1/ping
curl http://localhost:8081/api/v1/ping
curl http://localhost:8082/api/v1/ping
```

**Freqtrade Login (should return token):**
```bash
curl -X POST http://localhost:8080/api/v1/token/login \
  -u freqtrader:SuperSecret1! \
  -H "Content-Type: application/json"
```

### 3. Verify in Browser

1. Open `http://localhost:3000` in your browser
2. You should see the FreqHub dashboard
3. Navigate to "Bots" to add bots

## Add Test Bots

### From Web Interface

1. Go to `http://localhost:3000`
2. Navigate to "Bots" in the menu
3. Click "Add Bot"
4. Fill out the form:

**Bot 1:**
- **Name**: `Freqtrade Test 1`
- **API URL**: `http://freqtrade-1:8080` (from Docker) or `http://localhost:8080` (from host)
- **Username**: `freqtrader`
- **Password**: `SuperSecret1!`

**Bot 2:**
- **Name**: `Freqtrade Test 2`
- **API URL**: `http://freqtrade-2:8080` (from Docker) or `http://localhost:8081` (from host)
- **Username**: `freqtrader`
- **Password**: `SuperSecret2!`

**Bot 3:**
- **Name**: `Freqtrade Test 3 (Disabled)`
- **API URL**: `http://freqtrade-3:8080` (from Docker) or `http://localhost:8082` (from host)
- **Username**: `freqtrader`
- **Password**: `SuperSecret3!`
- **Note**: This bot is disabled in the example database but available for testing

### From API

```bash
# Add Bot 1
curl -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Freqtrade Test 1",
    "apiUrl": "http://freqtrade-1:8080",
    "username": "freqtrader",
    "password": "SuperSecret1!"
  }'

# Add Bot 2
curl -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Freqtrade Test 2",
    "apiUrl": "http://freqtrade-2:8080",
    "username": "freqtrader",
    "password": "SuperSecret2!"
  }'

# Add Bot 3 (disabled in example DB)
curl -X POST http://localhost:3001/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Freqtrade Test 3 (Disabled)",
    "apiUrl": "http://freqtrade-3:8080",
    "username": "freqtrader",
    "password": "SuperSecret3!",
    "isEnabled": false
  }'
```

## Common Test Cases

### 1. Multi-Bot Dashboard

1. Add at least 2 bots
2. Go to the main Dashboard
3. Verify that aggregated statistics from all bots are displayed
4. Verify that each bot shows its individual status

### 2. Bot Detail View

1. Click on a bot from the Dashboard
2. Verify that it displays:
   - Bot status (running/stopped)
   - Balance
   - Open trades
   - Recent closed trades
3. Test the controls:
   - Start
   - Stop
   - Pause

### 3. API Proxy

1. From the bot detail view
2. Verify that data loads correctly
3. Data should come from the backend proxy, not directly from Freqtrade

### 4. Bot Management

1. Go to "Bots" in the menu
2. Test:
   - Add bot
   - Edit bot
   - Enable/Disable bot
   - Delete bot
   - Test connection

## Monitoring and Logs

### View Logs from All Services

```bash
docker-compose -f docker-compose.full.yml logs -f
```

### View Logs from a Specific Service

```bash
# Backend
docker-compose -f docker-compose.full.yml logs -f backend

# Frontend
docker-compose -f docker-compose.full.yml logs -f frontend

# Freqtrade 1
docker-compose -f docker-compose.full.yml logs -f freqtrade-1

# Freqtrade 2
docker-compose -f docker-compose.full.yml logs -f freqtrade-2

# Freqtrade 3
docker-compose -f docker-compose.full.yml logs -f freqtrade-3
```

### View Container Status

```bash
docker-compose -f docker-compose.full.yml ps
```

### Verify Health Checks

```bash
docker-compose -f docker-compose.full.yml ps
```

All services should show "healthy" in the status column.

## Troubleshooting

### Problem: Services don't start

**Solution:**
1. Verify that ports are not in use:
   ```bash
   lsof -i :3000 -i :3001 -i :8080 -i :8081 -i :8082
   ```
2. Check the logs:
   ```bash
   docker-compose -f docker-compose.full.yml logs
   ```
3. Make sure Docker has enough resources allocated

### Problem: Backend cannot connect to Freqtrade

**Solution:**
1. Verify that services are on the same Docker network:
   ```bash
   docker network inspect freqhub_freqhub-network
   ```
2. From the backend, test the connection:
   ```bash
   docker exec freqhub-backend wget -O- http://freqtrade-1:8080/api/v1/ping
   ```
3. Verify that URLs use service names when accessing from Docker

### Problem: Authentication error with Freqtrade

**Solution:**
1. Verify credentials in the Freqtrade configuration file
2. Make sure environment variables `FREQTRADE_USERNAME` and `FREQTRADE_PASSWORD` match
3. Verify that the JWT secret is valid

### Problem: Frontend doesn't load data

**Solution:**
1. Open browser developer tools (F12)
2. Check the console for errors
3. Check the Network tab to see which requests fail
4. Verify that `VITE_API_PROXY_TARGET` is configured correctly

### Problem: Database doesn't get created

**Solution:**
1. Verify that the `backend/data` directory exists and has write permissions
2. Verify that `DATABASE_PATH` in `.env` is correct
3. Check backend logs for database errors

## Clean Up Environment

### Stop All Services

```bash
docker-compose -f docker-compose.full.yml down
```

### Remove Volumes and Data

⚠️ **Warning**: This will delete all data, including configured bots and Freqtrade data.

```bash
docker-compose -f docker-compose.full.yml down -v
rm -rf backend/data/*
rm -rf examples/docker/freqtrade-data-1/*
rm -rf examples/docker/freqtrade-data-2/*
rm -rf examples/docker/freqtrade-data-3/*
```

### Rebuild Images

If you've made code changes:

```bash
docker-compose -f docker-compose.full.yml build --no-cache
docker-compose -f docker-compose.full.yml up -d
```

## Next Steps

Once you have the stack running:

1. **Explore the Dashboard**: View aggregated statistics from all bots
2. **Test Controls**: Start, stop, and pause bots from the interface
3. **Monitor Trades**: Watch trades in real-time
4. **Compare Strategies**: Use multiple bots with different strategies
5. **Develop New Features**: The stack is ready for development

## Additional Resources

- [Freqtrade API Documentation](https://www.freqtrade.io/en/stable/rest-api/)
- [FreqHub Documentation](../README.md)
- [Issues and Support](https://github.com/hrodrig/freqhub/issues)

---

**Note**: This environment is configured for development and testing. For production, make sure to:
- Change all passwords and secrets
- Configure HTTPS
- Use a more robust database (PostgreSQL/MySQL)
- Configure regular backups
- Review security configuration
