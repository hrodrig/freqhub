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

# Script to test connectivity between FreqHub and Freqtrade instances
# Verifies that all services are working correctly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

section() {
    echo -e "\n${BLUE}▶${NC} $1"
}

# Function to make HTTP requests
http_get() {
    local url=$1
    local expected_status=${2:-200}
    local response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo -e "\n000")
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" = "$expected_status" ]; then
        return 0
    else
        return 1
    fi
}

# Function to test endpoint with authentication
http_get_auth() {
    local url=$1
    local username=$2
    local password=$3
    local expected_status=${4:-200}
    
    local response=$(curl -s -w "\n%{http_code}" -u "$username:$password" "$url" 2>/dev/null || echo -e "\n000")
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" = "$expected_status" ]; then
        echo "$body"
        return 0
    else
        return 1
    fi
}

echo "🔍 Testing complete stack connectivity..."
echo ""

# Default configuration
FREQTRADE_USERNAME=${FREQTRADE_USERNAME:-freqtrader}
FREQTRADE_PASSWORD=${FREQTRADE_PASSWORD:-SuperSecret1!}
BACKEND_URL=${BACKEND_URL:-http://localhost:3001}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}
FREQTRADE_1_URL=${FREQTRADE_1_URL:-http://localhost:8080}
FREQTRADE_2_URL=${FREQTRADE_2_URL:-http://localhost:8081}

# 1. Test FreqHub Backend
section "Testing FreqHub Backend"
if http_get "$BACKEND_URL/api/healthz"; then
    info "Backend is responding correctly"
else
    error "Backend is not responding at $BACKEND_URL/api/healthz"
    exit 1
fi

# 2. Test FreqHub Frontend
section "Testing FreqHub Frontend"
if http_get "$FRONTEND_URL" 200; then
    info "Frontend is responding correctly"
else
    warn "Frontend is not responding at $FRONTEND_URL (may still be starting)"
fi

# 3. Test Freqtrade Instance 1
section "Testing Freqtrade Instance 1"
if http_get "$FREQTRADE_1_URL/api/v1/ping"; then
    info "Freqtrade-1 is responding correctly"
    
    # Test login
    if http_get_auth "$FREQTRADE_1_URL/api/v1/token/login" "$FREQTRADE_USERNAME" "$FREQTRADE_PASSWORD" 200 > /dev/null; then
        info "Authentication to Freqtrade-1 successful"
    else
        error "Authentication error with Freqtrade-1"
    fi
else
    error "Freqtrade-1 is not responding at $FREQTRADE_1_URL/api/v1/ping"
fi

# 4. Test Freqtrade Instance 2
section "Testing Freqtrade Instance 2"
if http_get "$FREQTRADE_2_URL/api/v1/ping"; then
    info "Freqtrade-2 is responding correctly"
    
    # Test login
    if http_get_auth "$FREQTRADE_2_URL/api/v1/token/login" "$FREQTRADE_USERNAME" "$FREQTRADE_PASSWORD" 200 > /dev/null; then
        info "Authentication to Freqtrade-2 successful"
    else
        error "Authentication error with Freqtrade-2"
    fi
else
    warn "Freqtrade-2 is not responding at $FREQTRADE_2_URL/api/v1/ping (may still be starting)"
fi

# 5. Test FreqHub API (list bots)
section "Testing FreqHub API"
if http_get "$BACKEND_URL/api/bots"; then
    info "Bots API is responding correctly"
else
    warn "Bots API is not responding (may be normal if no bots are configured)"
fi

# 6. Verify connectivity between Docker services
section "Verifying connectivity between Docker services"
if docker ps | grep -q "freqhub-backend"; then
    info "Backend container is running"
    
    # Test connection from backend to freqtrade-1
    if docker exec freqhub-backend wget -q --spider --timeout=5 http://freqtrade-1:8080/api/v1/ping 2>/dev/null; then
        info "Backend can connect to freqtrade-1"
    else
        warn "Backend cannot connect to freqtrade-1 (check Docker network)"
    fi
    
    if docker ps | grep -q "freqtrade-2"; then
        if docker exec freqhub-backend wget -q --spider --timeout=5 http://freqtrade-2:8080/api/v1/ping 2>/dev/null; then
            info "Backend can connect to freqtrade-2"
        else
            warn "Backend cannot connect to freqtrade-2 (check Docker network)"
        fi
    fi
else
    warn "Backend container is not running"
fi

# Summary
echo ""
section "Test Summary"
info "Connectivity tests completed"
echo ""
echo "Service URLs:"
echo "  - Frontend:    $FRONTEND_URL"
echo "  - Backend:     $BACKEND_URL"
echo "  - Freqtrade-1: $FREQTRADE_1_URL"
echo "  - Freqtrade-2: $FREQTRADE_2_URL"
echo ""
echo "Test credentials:"
echo "  - Username: $FREQTRADE_USERNAME"
echo "  - Password: $FREQTRADE_PASSWORD"
echo ""
