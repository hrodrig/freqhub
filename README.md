# FreqHub

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

**FreqHub** is a modern, multi-bot dashboard for [Freqtrade](https://github.com/freqtrade/freqtrade), designed to monitor and control multiple trading bot instances from a single unified interface. Perfect for Kubernetes deployments and multi-strategy trading setups.

## ⚠️ Early Development

This project is currently in **early development** (alpha stage) and is not yet ready for production use. Features are being actively developed and the API may change without notice.

## ⚖️ Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

**Trading cryptocurrencies involves substantial risk of loss and is not suitable for every investor.** The value of cryptocurrencies may fluctuate, and you may lose some or all of your investment. Past performance is not indicative of future results. You should carefully consider whether trading cryptocurrencies is suitable for you in light of your circumstances, knowledge, and financial resources.

By using this software, you acknowledge that:
- You understand the risks involved in cryptocurrency trading
- You are solely responsible for any trading decisions made
- The authors and contributors are not responsible for any financial losses
- You will not hold the authors liable for any damages arising from the use of this software

## 🎯 Why FreqHub?

While [FreqUI](https://github.com/freqtrade/frequi) is an excellent single-bot interface, FreqHub addresses the need for **simultaneous multi-bot management**:

- **Multi-Bot Dashboard**: Monitor and control multiple Freqtrade instances simultaneously
- **Backend API**: Secure storage of bot credentials in SQLite database
- **Proxy System**: Backend acts as proxy to Freqtrade, avoiding CORS issues
- **Kubernetes-Ready**: Designed for containerized deployments with configurable base paths
- **Strategy Comparison**: Compare performance across different trading strategies
- **Unified Interface**: Single dashboard for all your trading operations
- **Real-Time Updates**: WebSocket support for live data from all connected bots
- **Event Bus**: Centralized event system with Valkey Pub/Sub for real-time notifications

## 🚀 Features

### Implemented Features

- ✅ **Multi-Bot Management**: Connect to multiple Freqtrade API instances
- ✅ **Secure Storage**: Bot credentials encrypted and stored in SQLite database
- ✅ **Unified Dashboard**: Aggregate view of all bots' performance
- ✅ **Individual Bot Views**: Detailed views for each bot instance
- ✅ **Proxy API**: Backend proxies all requests to Freqtrade with automatic authentication
- ✅ **Base Path Support**: Configurable base paths for reverse proxy deployments
- ✅ **Kubernetes Integration**: Optimized for Kubernetes ingress configurations
- ✅ **Valkey Cache**: High-performance caching layer using Valkey (Redis-compatible) with automatic fallback to in-memory storage
- ✅ **Smart Bot State Caching**: Automatic caching of bot status, balance, trades, and configuration with intelligent TTLs
- ✅ **Batch Operations**: Efficient batch retrieval of multiple bot states with cache optimization
- ✅ **Event Bus**: Centralized event system with Valkey Pub/Sub for distributed event broadcasting
- ✅ **WebSocket Support**: Real-time bidirectional communication for live updates to the frontend
- ✅ **Real-Time Bot Updates**: Automatic event publishing when bot data changes (trades, balance, status)
- ✅ **Automatic Polling Service**: Background service that keeps bot data fresh in cache, ensuring instant dashboard loads
- ✅ **Online/Offline Detection**: Real-time detection of bot connectivity changes with automatic event publishing
- ✅ **Rate Limiting**: Protects Freqtrade APIs from being overwhelmed with configurable limits per bot
- ✅ **Bot Notes**: Add custom notes to each bot for better organization and documentation
- ✅ **Modern Frontend UI**: Complete React-based dashboard with real-time updates, bot management, and detailed views
- ✅ **User Management**: Database schema for users, roles, and bot ownership (Phase 1 complete)
- ✅ **Audit Logging**: Comprehensive audit log system for tracking all user actions (Phase 1 complete)
- ✅ **Automatic Superadmin**: System automatically creates default superadmin on first startup

### Planned Features

- 🔄 **Authentication & Authorization**: JWT-based authentication with role-based access control (RBAC) - Phase 2
- 🔄 **User Roles**: Superadmin, Auditor, and Normal User roles with different permission levels - Phase 2
- 🔄 **Trade Management**: Execute trades across multiple bots
- 🔄 **Backtest Comparison**: Compare backtest results across strategies
- 🔄 **Alert System**: Centralized alerts from all bot instances

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- One or more [Freqtrade](https://github.com/freqtrade/freqtrade) instances running with API enabled
- Modern web browser (Chrome, Firefox, Safari, Edge)
- **Optional**: Valkey or Redis for enhanced caching performance (recommended for production with multiple bots)

## 🛠️ Installation

### Quick Start with Makefile (Recommended)

FreqHub includes a Makefile for easy automation. After cloning the repository:

```bash
# Complete setup (installs dependencies, creates .env files, sets up example DB)
make setup

# Start development servers (backend + frontend)
make dev

# Or start them separately
make dev-backend  # Backend only
make dev-frontend  # Frontend only
```

**Available Makefile commands:**
- `make help` - Show all available commands
- `make setup` - Complete initial setup
- `make install` - Install all dependencies
- `make dev` - Start both backend and frontend
- `make build` - Build for production
- `make docker-up` - Start with Docker Compose
- `make lint` - Run linters
- `make format` - Format code
- `make test-websocket` - Test WebSocket connection
- `make test-polling` - Test polling service
- `make status` - Check service status

See `make help` for the complete list of commands.

### Manual Setup

If you prefer to set up manually:

```bash
# Clone the repository
git clone https://github.com/hrodrig/freqhub.git
cd freqhub

# Backend setup
cd backend
cp .env.example .env
# Edit .env with your configuration
npm install  # or pnpm install / yarn install

# Option 1: Use the example database (recommended for first-time setup)
cp data/freqhub.db.example data/freqhub.db

# Option 2: Start with an empty database (will be created automatically)
# Just run: npm run dev

npm run dev

# Frontend setup (in another terminal)
cd frontend
cp .env.example .env  # If .env.example exists
npm install  # or pnpm install / yarn install

# Install UI dependencies (Tailwind CSS, Shadcn UI, etc.)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install additional dependencies for modern UI
npm install recharts lucide-react
npm install -D @types/node

npm run dev
```

The backend will start on `http://localhost:3001` and the frontend on `http://localhost:3000`.

**Note:** The Makefile (`make setup`) automates all of the above steps for faster setup.

### Production Build

**With Makefile:**
```bash
make build        # Build both backend and frontend
make build-backend   # Backend only
make build-frontend  # Frontend only
```

**Manual:**
```bash
# Build backend
cd backend
npm run build
npm start

# Build frontend
cd frontend
npm run build
# Serve the dist/ directory with your web server
```

### Docker Deployment

**With Makefile:**
```bash
make docker-up      # Start all services
make docker-down    # Stop all services
make docker-logs    # View logs
make docker-build   # Build images
```

**Manual:**
```bash
# Build and run with docker-compose
docker-compose -f docker-compose.full.yml up -d
```

### Valkey Cache Setup (Optional but Recommended)

Valkey provides high-performance caching for multi-bot scenarios. It's a Redis-compatible fork with a BSD license, making it ideal for open-source projects.

**With Docker Compose:**
Valkey will be automatically included when using `docker-compose.full.yml` (see [examples/docker/README.md](examples/docker/README.md)).

**Local Development:**
```bash
# macOS
brew install valkey

# Linux (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install valkey

# Start Valkey
valkey-server
```

Then set in `backend/.env`:
```env
VALKEY_ENABLED=true
VALKEY_HOST=localhost
VALKEY_PORT=6379
```

**Benefits:**
- **Faster data loading**: Bot states, balances, and trades are automatically cached
- **Reduced API load**: Intelligent caching reduces requests to Freqtrade APIs by up to 80%
- **Smart TTLs**: Different cache durations based on data volatility (status: 5s, balance: 10s, config: 30s)
- **Batch operations**: Efficient retrieval of multiple bot states in a single operation
- **Automatic invalidation**: Cache is automatically cleared on write operations (start/stop/pause)
- **Real-time events**: Event Bus with Valkey Pub/Sub for distributed event broadcasting
- **WebSocket integration**: Real-time updates pushed to frontend via Socket.io
- **Rate limiting**: Built-in support for rate limiting per bot
- **Session storage**: User session management with configurable TTL
- **Automatic fallback**: Seamlessly falls back to in-memory cache if Valkey is unavailable

## 🔐 Authentication & Authorization (AAA)

FreqHub includes a comprehensive Authentication, Authorization, and Audit (AAA) system. Currently, **Phase 1** (Database and Models) is complete.

### Phase 1: Database & Models ✅

- **User Management**: Database schema for users with roles (superadmin, auditor, user)
- **Bot Ownership**: Track which users own which bots
- **Audit Logging**: Comprehensive audit log system for tracking all actions
- **Automatic Superadmin**: System automatically creates a default superadmin on first startup

**Default Superadmin Credentials:**
When the system starts for the first time (or if no superadmin exists), it automatically creates a superadmin user with:
- **Username**: `freqhub` (configurable via `DEFAULT_ADMIN_USERNAME` env var)
- **Email**: `admin@freqhub.local` (configurable via `DEFAULT_ADMIN_EMAIL` env var)
- **Password**: Randomly generated secure password (16+ characters)

**⚠️ Important**: The superadmin credentials are displayed **ONCE** in the server logs on first startup. Make sure to:
1. Copy the credentials immediately
2. Change the password after first login
3. Store the credentials securely

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

### Planned Phases

- **Phase 2**: JWT-based authentication, login/logout endpoints, password hashing
- **Phase 3**: Role-based access control (RBAC), bot ownership enforcement
- **Phase 4**: Advanced security (2FA, QR login, session management)

## ⚙️ Configuration

### Backend Environment Variables

Create `backend/.env`:

```env
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/freqhub.db
ENCRYPTION_KEY=your-secret-encryption-key-min-32-characters
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info

# Valkey Cache Configuration (Optional)
# Valkey is a Redis-compatible fork with BSD license, recommended for open-source projects
VALKEY_ENABLED=true
VALKEY_HOST=localhost
VALKEY_PORT=6379
VALKEY_PASSWORD=  # Optional, leave empty for development

# Polling Service Configuration (Optional)
# Automatic background polling keeps bot data fresh in cache
POLLING_ENABLED=true  # Set to false to disable automatic polling
POLLING_INTERVAL=10000  # Polling interval in milliseconds (default: 10000 = 10 seconds)

# Rate Limiting Configuration (Optional)
# Protects Freqtrade APIs from being overwhelmed
RATE_LIMIT_ENABLED=true  # Set to false to disable rate limiting
RATE_LIMIT_DEFAULT=60  # Default requests per window (default: 60)
RATE_LIMIT_WINDOW=60  # Time window in seconds (default: 60)

# Superadmin Initialization (Optional)
# Customize the default superadmin username and email
DEFAULT_ADMIN_USERNAME=freqhub  # Default: freqhub
DEFAULT_ADMIN_EMAIL=admin@freqhub.local  # Default: admin@freqhub.local
```

**Note**: If `VALKEY_ENABLED=false` or Valkey is unavailable, the system automatically falls back to in-memory caching. This ensures the application works even without Valkey, though with reduced performance for multi-bot scenarios.

**Polling Service**: The polling service runs in the background and automatically refreshes bot data (ping, open trades, balance, state) to keep the cache fresh. This ensures that when users open the dashboard, data is already available. The service is smart and skips bots that already have fresh cache data, reducing unnecessary API calls. 

**Key Features:**
- Always checks bot connectivity (ping) first, even if cache is fresh, to detect online/offline changes
- Publishes `bot_online` and `bot_offline` events when bot connectivity changes
- Only polls other endpoints (trades, balance, state) if bot is online
- Automatically detects bots that come back online after being offline

Set `POLLING_ENABLED=false` to disable it if you prefer on-demand caching only.

**Rate Limiting**: Protects Freqtrade APIs from being overwhelmed by too many requests. Each bot has its own rate limit counter (default: 60 requests per 60 seconds). When the limit is exceeded, requests return HTTP 429 with `Retry-After` header. All responses include `X-RateLimit-*` headers for monitoring. The service uses Valkey for distributed rate limiting (with in-memory fallback). 

**Important**: The polling service does NOT count towards rate limits, as it's an internal service that keeps the cache fresh. Only frontend requests (via API routes) are rate-limited. Set `RATE_LIMIT_ENABLED=false` to disable it.

### Frontend Setup

**With Makefile (Recommended):**
```bash
make setup  # Installs all dependencies including frontend
make dev-frontend  # Start frontend only
```

**Manual Setup:**
```bash
cd frontend
npm install  # or pnpm install / yarn install

# Install UI dependencies (Tailwind CSS, Shadcn UI, etc.)
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install additional dependencies for modern UI
npm install recharts lucide-react
npm install -D @types/node

# Create .env file
cp .env.example .env  # If .env.example exists
# Or create manually with:
# VITE_BASE_PATH=/
# VITE_API_PROXY_TARGET=http://localhost:3001

npm run dev
```

**Frontend Dependencies:**
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Zustand** - State management
- **Axios** - HTTP client
- **Socket.io-client** - WebSocket client for real-time updates
- **Tailwind CSS v4** - Utility-first CSS framework
- **Recharts** - Chart library for data visualization
- **Lucide React** - Modern icon library
- **Zod** - Schema validation

### Frontend Environment Variables

Create `frontend/.env`:

```env
VITE_BASE_PATH=/
VITE_API_PROXY_TARGET=http://localhost:3001
```

### Base Path Configuration

FreqHub supports configurable base paths for deployment behind reverse proxies (e.g., Kubernetes Ingress, Nginx):

```bash
# Development
VITE_BASE_PATH=/freqhub/ pnpm dev

# Production (Docker)
docker run -e BASE_PATH=/freqhub/ freqhub
```

### Freqtrade API Configuration

Each Freqtrade instance must have the API enabled with CORS configured:

```json
{
  "api_server": {
    "enabled": true,
    "listen_ip_address": "0.0.0.0",
    "listen_port": 8080,
    "CORS_origins": ["https://your-freqhub-domain.com"],
    "username": "your_username",
    "password": "your_password"
  }
}
```

## 🧪 Testing & Validation

### WebSocket Testing

FreqHub includes tools to test and validate the Event Bus and WebSocket functionality:

**1. WebSocket Test Client:**
```bash
cd backend
npm run test:websocket [botId]
```

This connects to the WebSocket server and listens for real-time events. You can publish test events using the test endpoint (see below).

**2. Test Endpoints (Development Only):**

- **Publish Test Event**: `POST /api/test/event`
  ```bash
  curl -X POST http://localhost:3001/api/test/event \
    -H "Content-Type: application/json" \
    -d '{"type":"test_event","botId":"test-bot-1","data":{"message":"Hello!"}}'
  ```

- **WebSocket Info**: `GET /api/test/websocket`
  Returns connection statistics and event information.

- **WebSocket Health**: `GET /api/healthz/websocket`
  Returns WebSocket service health and client statistics.

**3. Polling Service Testing:**

- **Get Polling Status**: `GET /api/test/polling`
- **Trigger Manual Poll**: `POST /api/test/polling` (forces immediate poll of all enabled bots)
- **Polling Health**: `GET /api/healthz/polling`

**4. Rate Limiting Testing:**

- **Get Rate Limit Status**: `GET /api/test/ratelimit`
- **Reset Rate Limit**: `POST /api/test/ratelimit/reset` (with `{"botId": "bot-123"}`)
- **Rate Limit Health**: `GET /api/healthz/ratelimit`
- **Trigger Manual Poll**: `POST /api/test/polling` (forces immediate poll of all enabled bots)
- **Polling Health**: `GET /api/healthz/polling`

**5. Health Checks:**

- **General Health**: `GET /api/healthz`
- **Cache Statistics**: `GET /api/healthz/cache`
- **WebSocket Status**: `GET /api/healthz/websocket`
- **Polling Service**: `GET /api/healthz/polling`
- **Rate Limiting**: `GET /api/healthz/ratelimit`

All endpoints are documented in Swagger UI at `http://localhost:3001/api-docs`.

### Polling Service Validation

To validate that the polling service is working correctly:

**1. Check service status:**
```bash
curl http://localhost:3001/api/healthz/polling | jq
```

Expected: `"enabled": true` and `"running": true`, with recent timestamps in `lastPollTimes`.

**2. Watch backend logs:**
When the service starts, you should see:
```
Starting polling service (interval: 10000ms)
```

Every 10 seconds (or your configured interval), you'll see:
```
[DEBUG] Polling 2 enabled bot(s)
[DEBUG] Polling bot bot-123
```

**3. Trigger manual poll:**
```bash
curl -X POST http://localhost:3001/api/test/polling
```

**4. Verify cache updates:**
```bash
# Check cache stats before
curl http://localhost:3001/api/healthz/cache | jq '.cache.stats.hitRate'

# Trigger poll
curl -X POST http://localhost:3001/api/test/polling

# Check cache stats after (wait 2 seconds)
curl http://localhost:3001/api/healthz/cache | jq '.cache.stats.hitRate'
```

The hit rate should increase after polling. You can also use the automated test script:
```bash
cd backend
./scripts/test-polling.sh
```

## 📖 Usage

### Adding a Bot

1. Navigate to "Bots" in the navigation
2. Click "Add Bot"
3. Enter:
   - Bot name (e.g., "EMAC-RSI-EMA200" - typically the strategy name)
   - Freqtrade API URL (e.g., `http://freqtrade-pod-1:8080`)
   - Username
   - Password
   - Notes (optional): Add custom notes about the bot's configuration, strategy, or purpose
4. Enable/Disable toggle: Control whether the bot is actively monitored
5. The system will test the connection before saving
6. Bot is added and ready to use

**Note**: Each bot displays its UUID below the name for easy identification and debugging when matching with backend logs.

### Dashboard View

The main dashboard provides:
- **Aggregated Statistics**: Total bots, enabled bots, total trades, and total profit (with time period selector)
- **Bot Status Cards**: Real-time status for each enabled bot showing:
  - Online/Offline connectivity status
  - Operational state (Running/Stopped/Paused)
  - Trading mode (Dry Run / Live Trading)
  - Exchange, Strategy, Timeframe, Stoploss
  - Open trades count and profit
  - Bot UUID for debugging
- **Quick Actions**: Start, Stop, Pause, Reload Config, Refresh, and Settings buttons for each bot
- **Real-Time Updates**: All data updates automatically via WebSocket when bot status changes
- **Global Refresh**: Manual refresh button to update all bots progressively (non-blocking)

### Individual Bot Views

Click on any bot to view:
- **Configuration**: API URL, WebSocket URL, username, notes, creation/update timestamps
- **Bot Status**: Current state (running/stopped/paused), mode (dry run/live), strategy, stake currency
- **Balance**: Total balance, stake currency, value, and detailed currency breakdown
- **Open Trades**: List of currently open trades with pair, amount, open rate, and profit
- **Closed Trades**: Recent closed trades with exit reasons and profit
- **Bot Controls**: Start, Stop, Pause, and Reload Config buttons (disabled based on current state)
- **Real-Time Updates**: All data refreshes automatically every 10 seconds

**Note**: Running bots cannot be edited or deleted. Stop the bot first to modify its configuration.

## 🏗️ Architecture

FreqHub is built with:

**Frontend:**
- React 18
- TypeScript
- Vite
- React Router
- Zustand (State Management)
- Axios

**Backend:**
- Node.js 18+
- Express
- TypeScript
- SQLite (with migration path to Postgres/MySQL)
- AES-256-CBC encryption for passwords
- bcrypt for password hashing (user authentication)
- Valkey (Redis-compatible cache) - Optional, with in-memory fallback
- ioredis (Valkey/Redis client)
- Socket.io (WebSocket server)
- Smart caching layer for bot states, balances, trades, and configurations
- Event Bus with Valkey Pub/Sub for real-time event distribution
- Automatic polling service for proactive data freshness
- Online/offline detection with real-time event publishing
- User management and audit logging system (Phase 1 complete)

## 🤝 Contributing

Contributions are welcome! This project is in early development and we'd love your help.

### Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Development Workflow

1. Fork the repository
2. Create a feature branch from `develop`
3. Make your changes
4. Test thoroughly
5. Submit a pull request to `develop`

### Branch Strategy

- `main`: Production-ready code
- `develop`: Development branch (default)
- Feature branches: `feature/your-feature-name`

## 📝 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

**Copyright (C) 2025 FreqHub Contributors**

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

## 🙏 Acknowledgments

- [Freqtrade](https://github.com/freqtrade/freqtrade) - The amazing trading bot this project is built for
- [FreqUI](https://github.com/freqtrade/frequi) - Inspiration and reference implementation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/hrodrig/freqhub/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hrodrig/freqhub/discussions)

---

**Note**: FreqHub is an independent project and is not officially affiliated with the Freqtrade project.
