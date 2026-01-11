# Docker Compose - Multiple Freqtrade Instances

This example shows how to run multiple Freqtrade instances using Docker Compose, ideal for being managed by FreqHub.

## Structure

```
examples/docker/
├── docker-compose.yml      # Configuration for multiple instances + Valkey
├── config.json.example     # Base Freqtrade configuration
├── .env.example           # Environment variables template (copy to .env)
├── setup.sh               # Setup script
├── README.md              # This documentation
├── freqtrade-data-1/      # Bot 1 data
│   ├── config.json        # Bot 1 configuration
│   └── strategies/        # Bot 1 strategies
├── freqtrade-data-2/      # Bot 2 data
│   ├── config.json        # Bot 2 configuration
│   └── strategies/        # Bot 2 strategies
└── freqtrade-data-3/      # Bot 3 data
    ├── config.json        # Bot 3 configuration
    └── strategies/        # Bot 3 strategies
```

**Note**: This example includes a **Valkey** service (Redis-compatible cache) that can be used by FreqHub for improved performance. Valkey is optional - FreqHub will work without it, but caching is recommended for multi-bot scenarios.

## Initial Setup

### 1. Prepare the Environment

```bash
cd examples/docker

# Run the setup script (creates directories and configs automatically)
./setup.sh

# Or manually:
mkdir -p freqtrade-data-1 freqtrade-data-2 freqtrade-data-3
cp config.json.example freqtrade-data-1/config.json
cp config.json.example freqtrade-data-2/config.json
cp config.json.example freqtrade-data-3/config.json

# Update passwords (Bot 2 and Bot 3)
# Edit freqtrade-data-2/config.json: change password to "SuperSecret2!"
# Edit freqtrade-data-3/config.json: change password to "SuperSecret3!"
```

### 2. Configure Credentials

#### Option A: Using Environment Variables (Recommended)

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and configure:

1. **API Server Credentials** (for FreqHub connection):
   - `FREQTRADE_USERNAME`: API username (default: `freqtrader`)
   - `FREQTRADE_PASSWORD_1`, `FREQTRADE_PASSWORD_2`, `FREQTRADE_PASSWORD_3`: API passwords for each bot
   - `FREQTRADE_JWT_SECRET`: JWT secret key (minimum 32 characters)

2. **Exchange Credentials** (Binance API keys):
   - `FREQTRADE_EXCHANGE_KEY_1`, `FREQTRADE_EXCHANGE_KEY_2`, `FREQTRADE_EXCHANGE_KEY_3`: Binance API keys
   - `FREQTRADE_EXCHANGE_SECRET_1`, `FREQTRADE_EXCHANGE_SECRET_2`, `FREQTRADE_EXCHANGE_SECRET_3`: Binance API secrets
   
   ⚠️ **Important**: 
   - For **dry-run mode** (paper trading), you can leave exchange credentials empty
   - For **live trading**, you **must** provide valid Binance API keys
   - Get your API keys from: https://www.binance.com/en/my/settings/api-management
   - **Never commit** your `.env` file to version control!

3. **Trading Mode**:
   - `FREQTRADE_DRY_RUN=true`: Paper trading (safe for testing)
   - `FREQTRADE_DRY_RUN=false`: Live trading (uses real money!)

#### Option B: Edit config.json Directly

Alternatively, edit `freqtrade-data-*/config.json` files directly:

```json
{
  "api_server": {
    "enabled": true,
    "listen_ip_address": "0.0.0.0",
    "listen_port": 8080,
    "username": "freqtrader",
    "password": "SuperSecret1!",
    "jwt_secret_key": "your-secure-jwt-secret-here"
  },
  "exchange": {
    "name": "binance",
    "key": "your-binance-api-key",
    "secret": "your-binance-api-secret"
  },
  "dry_run": true
}
```

⚠️ **Security Notes**:
- Change all passwords and JWT secrets to secure values
- Never commit API keys or secrets to version control
- Use environment variables (`.env`) for sensitive data
- For production, use Docker secrets or a secrets manager

### 3. Strategies

Each bot includes a `SampleStrategy` in `freqtrade-data-*/strategies/SampleStrategy.py`. This is a basic example strategy that uses RSI indicators.

You can:
- Use the default `SampleStrategy` (already configured in docker-compose.yml)
- Create your own strategies in each `freqtrade-data-*/strategies/` directory
- Configure different strategies per bot using environment variables:

```env
FREQTRADE_STRATEGY_1=MyStrategy1
FREQTRADE_STRATEGY_2=MyStrategy2
FREQTRADE_STRATEGY_3=MyStrategy3
```

Or configure directly in each instance's `config.json` files.

## Usage

### Start the Instances

```bash
docker-compose up -d
```

This will start:
- **valkey** (cache service) at `localhost:6379` (optional, for FreqHub caching)
- **freqtrade-bot-1** at `http://localhost:8080`
- **freqtrade-bot-2** at `http://localhost:8081`
- **freqtrade-bot-3** at `http://localhost:8082`

### Verify They're Working

```bash
# Bot 1
curl http://localhost:8080/api/v1/ping

# Bot 2
curl http://localhost:8081/api/v1/ping

# Bot 3
curl http://localhost:8082/api/v1/ping
```

All should respond: `{"status":"pong"}`

### View Logs

```bash
# All bots
docker-compose logs -f

# Specific bot
docker-compose logs -f freqtrade-bot-1
```

### Stop the Instances

```bash
docker-compose down
```

### Stop and Remove Data

```bash
docker-compose down -v
# This will remove volumes with data
```

## Access FreqHub and Get Login Credentials

### Default Login Credentials

On first startup, FreqHub automatically creates a superadmin user. The credentials are displayed **ONCE** in the backend logs.

**To find the credentials:**

```bash
# View backend logs to find the superadmin credentials
docker compose logs freqhub-backend | grep -A 5 "SUPERADMIN CREATED"

# Or view all backend logs
docker compose logs freqhub-backend
```

**Default credentials format:**
- **Username**: `freqhub` (configurable via `DEFAULT_ADMIN_USERNAME` env var)
- **Email**: `admin@freqhub.local` (configurable via `DEFAULT_ADMIN_EMAIL` env var)
- **Password**: Randomly generated secure password (16+ characters) - shown in logs

**⚠️ Important:**
- The credentials are displayed **ONCE** in the server logs on first startup
- Copy the credentials immediately
- Change the password after first login
- Store the credentials securely

**Example log output:**
```
================================================================================
⚠️  SUPERADMIN CREATED AUTOMATICALLY
================================================================================
👤 Username: freqhub
🔑 Password: [randomly generated]
📧 Email: admin@freqhub.local
================================================================================
⚠️  IMPORTANT: Change the password after the first login
⚠️  These credentials are only shown ONCE
================================================================================
```

**Access FreqHub:**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Swagger API Docs**: http://localhost:3001/api-docs

## Connect with FreqHub

Once the instances are running and you're logged in, you can add them in FreqHub:

**⚠️ Important - URL Format:**

The API URL depends on your deployment scenario:

- **Local Development** (FreqHub running locally, Freqtrade in Docker): Use `http://localhost:8080`
- **Docker Compose** (both FreqHub and Freqtrade in Docker): Use Docker service names like `http://freqtrade-bot-1:8080`
- **Kubernetes**: Use Kubernetes service names like `http://freqtrade-service-name:8080`

**Note**: When FreqHub backend runs inside Docker/Kubernetes, it needs to connect to Freqtrade using service names (not `localhost`), as `localhost` refers to the container itself.

### Bot 1
- **Name**: `Freqtrade Bot 1`
- **API URL**: 
  - `http://localhost:8080` (if FreqHub is running locally/developing)
  - `http://freqtrade-bot-1:8080` (if using Docker Compose)
  - `http://<service-name>:8080` (if using Kubernetes)
- **Username**: `freqtrader` (or the one you configured)
- **Password**: `SuperSecret1!` (or the one you configured)

### Bot 2
- **Name**: `Freqtrade Bot 2`
- **API URL**: 
  - `http://localhost:8081` (if FreqHub is running locally/developing)
  - `http://freqtrade-bot-2:8080` (if using Docker Compose)
  - `http://<service-name>:8080` (if using Kubernetes)
- **Username**: `freqtrader` (or the one you configured)
- **Password**: `SuperSecret2!` (or the one you configured)

### Bot 3
- **Name**: `Freqtrade Bot 3 (Disabled)`
- **API URL**: 
  - `http://localhost:8082` (if FreqHub is running locally/developing)
  - `http://freqtrade-bot-3:8080` (if using Docker Compose)
  - `http://<service-name>:8080` (if using Kubernetes)
- **Username**: `freqtrader` (or the one you configured)
- **Password**: `SuperSecret3!` (or the one you configured)
- **Note**: This bot is disabled in the example database but available for testing

## Customization

### Add More Instances

To add a fourth instance, copy the service block in `docker-compose.yml`:

```yaml
freqtrade-bot-4:
  image: freqtradeorg/freqtrade:stable
  container_name: freqtrade-bot-4
  restart: unless-stopped
  volumes:
    - ./freqtrade-data-4:/freqtrade/user_data
  ports:
    - "8083:8080"  # Different port
  # ... rest of similar configuration
```

And add the environment variable:
```env
FREQTRADE_STRATEGY_4=MyStrategy4
```

### Change Ports

If ports 8080, 8081, or 8082 are in use, change the mapping in `docker-compose.yml`:

```yaml
ports:
  - "9080:8080"  # External port:internal port
```

### Per-Instance Configuration

Each instance has its own data directory (`freqtrade-data-1`, `freqtrade-data-2`, `freqtrade-data-3`), allowing:
- Different strategies
- Different trading pairs
- Different risk configurations
- Independent data (databases, logs)

## Troubleshooting

### Error: Port already in use

```bash
# Check what's using the port
lsof -i :8080
lsof -i :8081

# Change ports in docker-compose.yml
```

### Error: Cannot connect to API

1. Verify the container is running: `docker-compose ps`
2. Check logs: `docker-compose logs freqtrade-bot-1`
3. Verify that `api_server.enabled` is `true` in `config.json`
4. Verify the port is correctly mapped

### Error: Health check fails

The health check can take up to 60 seconds to pass. If it fails:
1. Check container logs
2. Verify the API is enabled
3. Increase `start_period` in the healthcheck if necessary

## Exchange Credentials

### Binance API Setup

To connect to Binance (or any exchange), you need API credentials:

1. **Create API Keys**:
   - Go to https://www.binance.com/en/my/settings/api-management
   - Create a new API key
   - **Important**: Enable only "Enable Reading" and "Enable Spot & Margin Trading" (disable withdrawals!)

2. **Configure in `.env`**:
   ```env
   FREQTRADE_EXCHANGE_KEY_1=your-api-key-here
   FREQTRADE_EXCHANGE_SECRET_1=your-api-secret-here
   ```

3. **Dry-Run vs Live Trading**:
   - **Dry-run mode** (`FREQTRADE_DRY_RUN=true`): No API keys needed, uses simulated trading
   - **Live trading** (`FREQTRADE_DRY_RUN=false`): **Requires valid API keys** and uses real money!

### Security Best Practices

- ✅ Use environment variables (`.env`) for credentials
- ✅ Never commit `.env` to version control
- ✅ Use different API keys for each bot if needed
- ✅ Restrict API key permissions (disable withdrawals!)
- ✅ Rotate API keys regularly
- ✅ Use IP whitelisting on Binance if possible

## Production

For production:

1. **Change all passwords** in `.env` and `config.json`
2. **Use secrets** for sensitive credentials (Docker secrets, Kubernetes secrets, etc.)
3. **Configure HTTPS** if exposing the APIs
4. **Use a reverse proxy** (Nginx, Traefik) instead of exposing ports directly
5. **Configure backups** of `freqtrade-data-*` directories
6. **Monitor resources** (CPU, memory, disk)
7. **Verify exchange credentials** are correctly configured before enabling live trading

## Valkey Cache (Optional)

This example includes a **Valkey** service (Redis-compatible fork with BSD license) that provides high-performance caching for FreqHub.

### What is Valkey?

Valkey is a Redis-compatible in-memory data store that FreqHub uses for:
- Caching bot states (faster data loading)
- Real-time event broadcasting (Pub/Sub)
- Rate limiting
- Session storage

### Configuration

Valkey is automatically started with the Freqtrade instances. To use it with FreqHub:

1. **In FreqHub backend `.env`**:
   ```env
   VALKEY_ENABLED=true
   VALKEY_HOST=localhost  # or 'valkey' if running in same Docker network
   VALKEY_PORT=6379
   ```

2. **If running FreqHub in Docker**, use the service name:
   ```env
   VALKEY_HOST=valkey
   ```

### Benefits

- ✅ Faster data loading (cached bot states)
- ✅ Reduced load on Freqtrade APIs
- ✅ Better performance with multiple bots
- ✅ Automatic fallback to memory if Valkey is unavailable

### Disabling Valkey

If you don't want to use Valkey, you can:
1. Remove the `valkey` service from `docker-compose.yml`
2. Set `VALKEY_ENABLED=false` in FreqHub backend `.env`

FreqHub will automatically fall back to in-memory caching.

## Additional Resources

- [Freqtrade Documentation](https://www.freqtrade.io/)
- [Freqtrade Docker](https://github.com/freqtrade/freqtrade#docker)
- [FreqHub README](../../README.md)
- [Valkey Documentation](https://valkey.io/)
