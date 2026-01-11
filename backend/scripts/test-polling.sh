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
#
# Test script for Polling Service
# This script helps validate that the polling service is working correctly
#

BASE_URL="${BASE_URL:-http://localhost:3001}"
BASE_PATH="${BASE_PATH:-}"

echo "🧪 Testing Polling Service"
echo "=========================="
echo ""

# 1. Check if polling service is enabled and running
echo "1️⃣  Checking polling service status..."
curl -s "${BASE_URL}${BASE_PATH}/api/healthz/polling" | jq '.' || echo "❌ Failed to get polling status"
echo ""

# 2. Get polling stats
echo "2️⃣  Getting polling statistics..."
curl -s "${BASE_URL}${BASE_PATH}/api/test/polling" | jq '.' || echo "❌ Failed to get polling stats"
echo ""

# 3. Check cache stats before manual poll
echo "3️⃣  Cache stats BEFORE manual poll..."
curl -s "${BASE_URL}${BASE_PATH}/api/healthz/cache" | jq '.cache.stats' || echo "❌ Failed to get cache stats"
echo ""

# 4. Trigger manual poll
echo "4️⃣  Triggering manual poll..."
curl -s -X POST "${BASE_URL}${BASE_PATH}/api/test/polling" | jq '.' || echo "❌ Failed to trigger poll"
echo ""

# 5. Wait a moment
echo "⏳ Waiting 2 seconds..."
sleep 2
echo ""

# 6. Check cache stats after manual poll
echo "5️⃣  Cache stats AFTER manual poll..."
curl -s "${BASE_URL}${BASE_PATH}/api/healthz/cache" | jq '.cache.stats' || echo "❌ Failed to get cache stats"
echo ""

# 7. Check polling service again
echo "6️⃣  Polling service status (after poll)..."
curl -s "${BASE_URL}${BASE_PATH}/api/healthz/polling" | jq '.polling.lastPollTimes' || echo "❌ Failed to get polling status"
echo ""

echo "✅ Test complete!"
echo ""
echo "💡 Tips:"
echo "   - Watch the backend logs to see polling activity"
echo "   - Check that 'lastPollTimes' shows recent timestamps"
echo "   - Verify cache hit rate increases after polling"
echo "   - Monitor WebSocket events if you have a client connected"

