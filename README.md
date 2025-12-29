# FreqHub

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

**FreqHub** is a modern, multi-bot dashboard for [Freqtrade](https://github.com/freqtrade/freqtrade), designed to monitor and control multiple trading bot instances from a single unified interface. Perfect for Kubernetes deployments and multi-strategy trading setups.

## ⚠️ Early Development

This project is currently in **early development** (alpha stage) and is not yet ready for production use. Features are being actively developed and the API may change without notice.

## 🎯 Why FreqHub?

While [FreqUI](https://github.com/freqtrade/frequi) is an excellent single-bot interface, FreqHub addresses the need for **simultaneous multi-bot management**:

- **Multi-Bot Dashboard**: Monitor and control multiple Freqtrade instances simultaneously
- **Kubernetes-Ready**: Designed for containerized deployments with configurable base paths
- **Strategy Comparison**: Compare performance across different trading strategies
- **Unified Interface**: Single dashboard for all your trading operations
- **Real-Time Updates**: WebSocket support for live data from all connected bots

## 🚀 Features

### Planned Features

- ✅ **Multi-Bot Management**: Connect to multiple Freqtrade API instances
- ✅ **Unified Dashboard**: Aggregate view of all bots' performance
- ✅ **Individual Bot Views**: Detailed views for each bot instance
- ✅ **Strategy Comparison**: Side-by-side comparison of trading strategies
- ✅ **Real-Time Monitoring**: WebSocket connections for live updates
- ✅ **Base Path Support**: Configurable base paths for reverse proxy deployments
- ✅ **Kubernetes Integration**: Optimized for Kubernetes ingress configurations
- 🔄 **Trade Management**: Execute trades across multiple bots
- 🔄 **Backtest Comparison**: Compare backtest results across strategies
- 🔄 **Alert System**: Centralized alerts from all bot instances

## 📋 Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- One or more [Freqtrade](https://github.com/freqtrade/freqtrade) instances running with API enabled
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 🛠️ Installation

### Development Setup

```bash
# Clone the repository
git clone https://github.com/hrodrig/freqhub.git
cd freqhub

# Install dependencies
pnpm install  # or npm install / yarn install

# Start development server
pnpm dev  # or npm run dev / yarn dev
```

The development server will start on `http://localhost:3000` (or the next available port).

### Production Build

```bash
# Build for production
pnpm build  # or npm run build / yarn build

# Preview production build
pnpm preview  # or npm run preview / yarn preview
```

### Docker Deployment

```bash
# Build Docker image
docker build -t freqhub .

# Run container
docker run -d \
  -p 3000:80 \
  -e BASE_PATH=/freqhub/ \
  freqhub
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_BASE_PATH` | Base path for the application (e.g., `/freqhub/`) | `/` |
| `VITE_API_PROXY_TARGET` | API proxy target for development | `http://127.0.0.1:8080` |

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

1. Navigate to the bot management section
2. Click "Add Bot"
3. Enter the Freqtrade API URL (e.g., `http://freqtrade-pod-1:8080`)
4. Enter your API credentials
5. Save and connect

### Dashboard View

The main dashboard provides:
- **Aggregated Statistics**: Total profit, win rate, active trades across all bots
- **Bot Status**: Health and status of each connected bot
- **Quick Actions**: Start/stop bots, view logs, manage strategies

### Individual Bot Views

Click on any bot to view:
- Real-time trading performance
- Active trades and positions
- Strategy details and configuration
- Historical performance charts

## 🏗️ Architecture

FreqHub is built with:

- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **React Router**: Client-side routing
- **WebSocket**: Real-time data updates
- **State Management**: Context API / Zustand (TBD)

## 🤝 Contributing

Contributions are welcome! This project is in early development and we'd love your help.

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

## 🙏 Acknowledgments

- [Freqtrade](https://github.com/freqtrade/freqtrade) - The amazing trading bot this project is built for
- [FreqUI](https://github.com/freqtrade/frequi) - Inspiration and reference implementation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/hrodrig/freqhub/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hrodrig/freqhub/discussions)

## 🔮 Roadmap

- [ ] Core multi-bot dashboard
- [ ] Real-time WebSocket integration
- [ ] Strategy comparison tools
- [ ] Backtest result comparison
- [ ] Alert and notification system
- [ ] Kubernetes Helm charts
- [ ] Comprehensive documentation
- [ ] Unit and integration tests

---

**Note**: FreqHub is an independent project and is not officially affiliated with the Freqtrade project.

