#!/bin/bash
# SWESociety Server Stop Script

echo "🛑 Stopping SWESociety servers..."

# Navigate to project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Kill processes on port 5500
echo "🔄 Stopping server on port 5500..."
lsof -ti:5500 | xargs kill -9 2>/dev/null || true

# Kill any node processes related to ProjecTra
pkill -f "node backend/server.js" 2>/dev/null || true
pkill -f "npm start" 2>/dev/null || true

# Clean up log file
if [ -f "server.log" ]; then
    rm -f server.log
fi

echo "✅ Servers stopped successfully"
echo "🔄 Port 5500 is now available"