#!/bin/bash
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

