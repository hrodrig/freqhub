#!/bin/bash
#
# FreqHub - Multi-bot dashboard for Freqtrade
# Copyright (C) 2025 - 2026  FreqHub Contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#
# USE AT YOUR OWN RISK
#
# This software is provided "as is", without warranty of any kind, express or implied,
# including but not limited to the warranties of merchantability, fitness for a particular
# purpose and noninfringement. In no event shall the authors or copyright holders be
# liable for any claim, damages or other liability, whether in an action of contract,
# tort or otherwise, arising from, out of or in connection with the software or the
# use or other dealings in the software.
#
# Trading cryptocurrencies involves substantial risk of loss and is not suitable for
# every investor. The value of cryptocurrencies may fluctuate, and you may lose some
# or all of your investment. Past performance is not indicative of future results.
# You should carefully consider whether trading cryptocurrencies is suitable for you
# in light of your circumstances, knowledge, and financial resources.
#
# By using this software, you acknowledge that:
# - You understand the risks involved in cryptocurrency trading
# - You are solely responsible for any trading decisions made
# - The authors and contributors are not responsible for any financial losses
# - You will not hold the authors liable for any damages arising from the use of this software

# Script to set up the complete FreqHub test environment
# This script initializes the database, creates Freqtrade configurations
# and verifies that everything is ready for testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Setting up FreqHub test environment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print messages
info() {
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Verify that Docker is installed and running
info "Checking Docker..."
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    error "Docker is not running. Please start Docker."
    exit 1
fi
info "Docker is installed and running"

# 2. Create necessary directories
info "Creating necessary directories..."
mkdir -p "$PROJECT_ROOT/backend/data"
mkdir -p "$PROJECT_ROOT/examples/docker/freqtrade-data-1"
mkdir -p "$PROJECT_ROOT/examples/docker/freqtrade-data-2"
mkdir -p "$PROJECT_ROOT/examples/docker/freqtrade-data-3"
info "Directories created"

# 3. Copy Freqtrade configuration to data directories
info "Configuring Freqtrade instances..."
if [ -f "$PROJECT_ROOT/docker/freqtrade-config.json" ]; then
    cp "$PROJECT_ROOT/docker/freqtrade-config.json" "$PROJECT_ROOT/examples/docker/freqtrade-data-1/config.json"
    cp "$PROJECT_ROOT/docker/freqtrade-config.json" "$PROJECT_ROOT/examples/docker/freqtrade-data-2/config.json"
    cp "$PROJECT_ROOT/docker/freqtrade-config.json" "$PROJECT_ROOT/examples/docker/freqtrade-data-3/config.json"
    # Update passwords for bots 2 and 3
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' 's/"password": "SuperSecret1!"/"password": "SuperSecret2!"/' "$PROJECT_ROOT/examples/docker/freqtrade-data-2/config.json"
        sed -i '' 's/"password": "SuperSecret1!"/"password": "SuperSecret3!"/' "$PROJECT_ROOT/examples/docker/freqtrade-data-3/config.json"
    else
        # Linux
        sed -i 's/"password": "SuperSecret1!"/"password": "SuperSecret2!"/' "$PROJECT_ROOT/examples/docker/freqtrade-data-2/config.json"
        sed -i 's/"password": "SuperSecret1!"/"password": "SuperSecret3!"/' "$PROJECT_ROOT/examples/docker/freqtrade-data-3/config.json"
    fi
    info "Freqtrade configurations copied (passwords: SuperSecret1!, SuperSecret2!, SuperSecret3!)"
else
    warn "freqtrade-config.json not found, instances will use default configuration"
fi

# 3.1. Verify that strategies exist
info "Verifying strategies..."
if [ -f "$PROJECT_ROOT/examples/docker/freqtrade-data-1/strategies/SampleStrategy.py" ]; then
    info "Strategies found in freqtrade-data-1"
    # Copy strategies to other bots if they don't exist
    if [ ! -f "$PROJECT_ROOT/examples/docker/freqtrade-data-2/strategies/SampleStrategy.py" ]; then
        mkdir -p "$PROJECT_ROOT/examples/docker/freqtrade-data-2/strategies"
        cp "$PROJECT_ROOT/examples/docker/freqtrade-data-1/strategies/SampleStrategy.py" "$PROJECT_ROOT/examples/docker/freqtrade-data-2/strategies/"
        info "Strategy copied to freqtrade-data-2"
    fi
    if [ ! -f "$PROJECT_ROOT/examples/docker/freqtrade-data-3/strategies/SampleStrategy.py" ]; then
        mkdir -p "$PROJECT_ROOT/examples/docker/freqtrade-data-3/strategies"
        cp "$PROJECT_ROOT/examples/docker/freqtrade-data-1/strategies/SampleStrategy.py" "$PROJECT_ROOT/examples/docker/freqtrade-data-3/strategies/"
        info "Strategy copied to freqtrade-data-3"
    fi
else
    warn "SampleStrategy.py not found in freqtrade-data-1/strategies/"
    warn "Bots will need a strategy to work correctly"
fi

# 4. Verify .env files
info "Verifying configuration files..."
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    warn ".env file not found in project root"
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        info "Copying .env.example to .env..."
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
        warn "Please edit .env with your configurations before continuing"
    fi
fi

if [ ! -f "$PROJECT_ROOT/backend/.env" ]; then
    if [ -f "$PROJECT_ROOT/backend/.env.example" ]; then
        info "Copying backend/.env.example to backend/.env..."
        cp "$PROJECT_ROOT/backend/.env.example" "$PROJECT_ROOT/backend/.env"
    fi
fi

if [ ! -f "$PROJECT_ROOT/frontend/.env" ]; then
    if [ -f "$PROJECT_ROOT/frontend/.env.example" ]; then
        info "Copying frontend/.env.example to frontend/.env..."
        cp "$PROJECT_ROOT/frontend/.env.example" "$PROJECT_ROOT/frontend/.env"
    fi
fi

# 5. Initialize database if it doesn't exist
info "Verifying database..."
if [ ! -f "$PROJECT_ROOT/backend/data/freqhub.db" ]; then
    if [ -f "$PROJECT_ROOT/backend/data/freqhub.db.example" ]; then
        info "Copying example database..."
        cp "$PROJECT_ROOT/backend/data/freqhub.db.example" "$PROJECT_ROOT/backend/data/freqhub.db"
        info "Example database copied (includes 3 preconfigured bots)"
        
        # Configure ENCRYPTION_KEY in backend/.env to match the example database
        EXAMPLE_ENCRYPTION_KEY="example-encryption-key-min-32-chars-for-demo"
        if [ -f "$PROJECT_ROOT/backend/.env" ]; then
            # Update or add ENCRYPTION_KEY in backend/.env
            if grep -q "^ENCRYPTION_KEY=" "$PROJECT_ROOT/backend/.env"; then
                # Update existing key
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$EXAMPLE_ENCRYPTION_KEY|" "$PROJECT_ROOT/backend/.env"
                else
                    sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$EXAMPLE_ENCRYPTION_KEY|" "$PROJECT_ROOT/backend/.env"
                fi
                info "ENCRYPTION_KEY updated in backend/.env to use example database"
            else
                # Add key if it doesn't exist
                echo "" >> "$PROJECT_ROOT/backend/.env"
                echo "ENCRYPTION_KEY=$EXAMPLE_ENCRYPTION_KEY" >> "$PROJECT_ROOT/backend/.env"
                info "ENCRYPTION_KEY added to backend/.env to use example database"
            fi
        else
            warn "backend/.env does not exist, create one with ENCRYPTION_KEY=$EXAMPLE_ENCRYPTION_KEY"
        fi
    else
        info "Database does not exist, will be created automatically when backend starts"
        warn "freqhub.db.example not found, database will be empty"
    fi
else
    info "Database already exists"
    if [ -f "$PROJECT_ROOT/backend/data/freqhub.db.example" ]; then
        warn "If you want to use the example database with preconfigured bots:"
        warn "  cp backend/data/freqhub.db.example backend/data/freqhub.db"
        warn "  And configure ENCRYPTION_KEY=example-encryption-key-min-32-chars-for-demo in backend/.env"
    fi
fi

# 6. Verify that ports are available
info "Checking port availability..."
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        warn "Port $port is in use"
        return 1
    else
        info "Port $port is available"
        return 0
    fi
}

check_port 3000 || warn "Port 3000 (frontend) is in use"
check_port 3001 || warn "Port 3001 (backend) is in use"
check_port 8080 || warn "Port 8080 (freqtrade-1) is in use"
check_port 8081 || warn "Port 8081 (freqtrade-2) is in use"
check_port 8082 || warn "Port 8082 (freqtrade-3) is in use"

# 7. Summary
echo ""
info "✅ Environment setup completed"
echo ""
echo "Next steps:"
echo "  1. Review and edit .env files if necessary"
echo "  2. Run: docker-compose -f docker-compose.full.yml up -d"
echo "  3. Wait for all services to be healthy"
echo "  4. Access http://localhost:3000 to use FreqHub"
echo "  5. Add the bots using:"
echo "     - Bot 1: http://freqtrade-1:8080 (or http://localhost:8080 from host) - Password: SuperSecret1!"
echo "     - Bot 2: http://freqtrade-2:8080 (or http://localhost:8081 from host) - Password: SuperSecret2!"
echo "     - Bot 3: http://freqtrade-3:8080 (or http://localhost:8082 from host) - Password: SuperSecret3!"
echo "     - Username: freqtrader"
echo ""
