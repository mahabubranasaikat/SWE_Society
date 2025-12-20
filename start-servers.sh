#!/bin/bash
# SWESociety Server Start Script

echo "🚀 Starting SWESociety servers..."

# Navigate to project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Kill any existing processes on port 5500
echo "🔄 Cleaning up existing processes on port 5500..."
lsof -ti:5500 | xargs kill -9 2>/dev/null || true

# Wait a moment for cleanup
sleep 2

# Start MySQL if not running
echo "🗄️ Checking MySQL status..."
if ! brew services list | grep mysql | grep -q "started"; then
    echo "Starting MySQL..."
    brew services start mysql
    sleep 3
fi

# Navigate to project root directory
echo "🖥️ Starting backend server..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project root directory."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
else
    echo "✅ Dependencies already installed"
fi

# Start the server in background
nohup npm start > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Check if server is running
if curl -s http://localhost:5500/api/health > /dev/null 2>&1; then
    echo "✅ Server started successfully on port 5500"
    echo "📱 Frontend available at: http://localhost:5500"
    echo "🔗 Login page: http://localhost:5500/auth/login.html"
    echo "📋 API: http://localhost:5500/api"
    echo "📄 Server logs: server.log"
    echo "🔴 To stop: ./stop-servers.sh"
else
    echo "❌ Server failed to start. Check server.log for details."
    cat server.log
    exit 1
fi