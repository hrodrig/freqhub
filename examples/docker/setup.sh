#!/bin/bash

# Setup script for Freqtrade Docker Compose examples
# This script prepares the environment to run multiple Freqtrade instances

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Setting up Freqtrade environment with Docker Compose..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check Docker
info "Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker."
    exit 1
fi
info "Docker is installed and running"

# 2. Create directories
info "Creating data directories..."
mkdir -p "$SCRIPT_DIR/freqtrade-data-1"
mkdir -p "$SCRIPT_DIR/freqtrade-data-2"
mkdir -p "$SCRIPT_DIR/freqtrade-data-3"
info "Directories created"

# 3. Copy configuration if it doesn't exist
info "Setting up configuration files..."
if [ ! -f "$SCRIPT_DIR/freqtrade-data-1/config.json" ]; then
    if [ -f "$SCRIPT_DIR/config.json.example" ]; then
        cp "$SCRIPT_DIR/config.json.example" "$SCRIPT_DIR/freqtrade-data-1/config.json"
        info "Configuration copied to freqtrade-data-1/config.json"
    else
        warn "config.json.example not found, create config.json manually"
    fi
fi

if [ ! -f "$SCRIPT_DIR/freqtrade-data-2/config.json" ]; then
    if [ -f "$SCRIPT_DIR/config.json.example" ]; then
        cp "$SCRIPT_DIR/config.json.example" "$SCRIPT_DIR/freqtrade-data-2/config.json"
        # Update password for bot 2
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' 's/"password": "SuperSecret1!"/"password": "SuperSecret2!"/' "$SCRIPT_DIR/freqtrade-data-2/config.json"
        else
            # Linux
            sed -i 's/"password": "SuperSecret1!"/"password": "SuperSecret2!"/' "$SCRIPT_DIR/freqtrade-data-2/config.json"
        fi
        info "Configuration copied to freqtrade-data-2/config.json (password: SuperSecret2!)"
    else
        warn "config.json.example not found, create config.json manually"
    fi
fi

if [ ! -f "$SCRIPT_DIR/freqtrade-data-3/config.json" ]; then
    if [ -f "$SCRIPT_DIR/config.json.example" ]; then
        cp "$SCRIPT_DIR/config.json.example" "$SCRIPT_DIR/freqtrade-data-3/config.json"
        # Update password for bot 3
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' 's/"password": "SuperSecret1!"/"password": "SuperSecret3!"/' "$SCRIPT_DIR/freqtrade-data-3/config.json"
        else
            # Linux
            sed -i 's/"password": "SuperSecret1!"/"password": "SuperSecret3!"/' "$SCRIPT_DIR/freqtrade-data-3/config.json"
        fi
        info "Configuration copied to freqtrade-data-3/config.json (password: SuperSecret3!)"
    else
        warn "config.json.example not found, create config.json manually"
    fi
fi

# 4. Copy strategies if they don't exist
info "Setting up strategy files..."
if [ ! -d "$SCRIPT_DIR/freqtrade-data-1/strategies" ]; then
    mkdir -p "$SCRIPT_DIR/freqtrade-data-1/strategies"
    if [ -f "$SCRIPT_DIR/freqtrade-data-1/strategies/SampleStrategy.py" ]; then
        info "Strategy already exists in freqtrade-data-1"
    else
        warn "SampleStrategy.py not found in freqtrade-data-1/strategies/"
        warn "Please create a strategy file or copy from another bot"
    fi
fi

if [ ! -d "$SCRIPT_DIR/freqtrade-data-2/strategies" ]; then
    mkdir -p "$SCRIPT_DIR/freqtrade-data-2/strategies"
    if [ -f "$SCRIPT_DIR/freqtrade-data-1/strategies/SampleStrategy.py" ]; then
        cp "$SCRIPT_DIR/freqtrade-data-1/strategies/SampleStrategy.py" "$SCRIPT_DIR/freqtrade-data-2/strategies/"
        info "Strategy copied to freqtrade-data-2"
    fi
fi

if [ ! -d "$SCRIPT_DIR/freqtrade-data-3/strategies" ]; then
    mkdir -p "$SCRIPT_DIR/freqtrade-data-3/strategies"
    if [ -f "$SCRIPT_DIR/freqtrade-data-1/strategies/SampleStrategy.py" ]; then
        cp "$SCRIPT_DIR/freqtrade-data-1/strategies/SampleStrategy.py" "$SCRIPT_DIR/freqtrade-data-3/strategies/"
        info "Strategy copied to freqtrade-data-3"
    fi
fi

# 5. Check .env (optional)
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    if [ -f "$SCRIPT_DIR/.env.example" ]; then
        info ".env file not found, but .env.example exists"
        info "Copy .env.example to .env and configure your credentials:"
        info "  cp .env.example .env"
        info "  # Then edit .env with your Binance API keys"
    else
        warn ".env file not found (optional for dry-run mode)"
    fi
else
    info ".env file found"
    warn "Make sure to configure Binance API keys in .env for live trading!"
fi

# 6. Summary
echo ""
info "✅ Setup completed"
echo ""
echo "Next steps:"
echo "  1. (Optional) Create .env file for credentials:"
echo "     cp .env.example .env"
echo "     # Edit .env with your Binance API keys (required for live trading)"
echo "  2. (Optional) Edit freqtrade-data-*/config.json if needed"
echo "  3. Run: docker-compose up -d"
echo "  4. Verify: curl http://localhost:8080/api/v1/ping"
echo "  5. Add the bots in FreqHub:"
echo "     - Bot 1: http://localhost:8080 (password: SuperSecret1!)"
echo "     - Bot 2: http://localhost:8081 (password: SuperSecret2!)"
echo "     - Bot 3: http://localhost:8082 (password: SuperSecret3!)"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - For dry-run mode (paper trading), no API keys needed"
echo "   - For live trading, you MUST configure Binance API keys in .env"
echo "   - Never commit .env to version control!"
echo ""
