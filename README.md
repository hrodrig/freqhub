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
- **Real-Time Updates**: WebSocket support for live data from all connected bots (coming soon)

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
- ✅ **Real-Time Events**: Pub/Sub support for real-time event broadcasting (ready for WebSocket integration)

### Planned Features

- 🔄 **Trade Management**: Execute trades across multiple bots
- 🔄 **Backtest Comparison**: Compare backtest results across strategies
- 🔄 **Alert System**: Centralized alerts from all bot instances
- 🔄 **WebSocket Support**: Real-time updates via WebSocket

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- One or more [Freqtrade](https://github.com/freqtrade/freqtrade) instances running with API enabled
- Modern web browser (Chrome, Firefox, Safari, Edge)
- **Optional**: Valkey or Redis for enhanced caching performance (recommended for production with multiple bots)

## 🛠️ Installation

### Development Setup

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
cp .env.example .env
npm install  # or pnpm install / yarn install
npm run dev
```

The backend will start on `http://localhost:3001` and the frontend on `http://localhost:3000`.

### Production Build

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

```bash
# Build and run with docker-compose
docker-compose up -d
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
- **Real-time events**: Pub/Sub support for real-time event broadcasting (ready for WebSocket)
- **Rate limiting**: Built-in support for rate limiting per bot
- **Session storage**: User session management with configurable TTL
- **Automatic fallback**: Seamlessly falls back to in-memory cache if Valkey is unavailable

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
```

**Note**: If `VALKEY_ENABLED=false` or Valkey is unavailable, the system automatically falls back to in-memory caching. This ensures the application works even without Valkey, though with reduced performance for multi-bot scenarios.

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

## 📖 Usage

### Adding a Bot

1. Navigate to "Bots" in the navigation
2. Click "Add Bot"
3. Enter:
   - Bot name
   - Freqtrade API URL (e.g., `http://freqtrade-pod-1:8080`)
   - Username
   - Password
4. The system will test the connection before saving
5. Bot is added and ready to use

### Dashboard View

The main dashboard provides:
- **Aggregated Statistics**: Total profit, win rate, active trades across all bots
- **Bot Status**: Health and status of each connected bot
- **Quick Access**: Click on any bot to view details

### Individual Bot Views

Click on any bot to view:
- Real-time trading performance
- Active trades and positions
- Historical trades
- Balance and profit information
- Bot controls (start/stop/pause)

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
- Valkey (Redis-compatible cache) - Optional, with in-memory fallback
- ioredis (Valkey/Redis client)
- Smart caching layer for bot states, balances, trades, and configurations

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
