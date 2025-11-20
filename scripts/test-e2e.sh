#!/bin/bash

# E2E Test Runner Script
# Starts the server, runs E2E tests, then shuts down the server

set -e  # Exit on error

echo "🚀 Starting DEX Order Execution Server..."

# Start the server in background
pnpm exec tsx src/server.ts &
SERVER_PID=$!

echo "📝 Server PID: $SERVER_PID"

# Function to cleanup server on exit
cleanup() {
  echo "🛑 Shutting down server (PID: $SERVER_PID)..."
  kill $SERVER_PID 2>/dev/null || true
  wait $SERVER_PID 2>/dev/null || true
  echo "✅ Server stopped"
}

# Register cleanup on script exit
trap cleanup EXIT INT TERM

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "   Attempt $RETRY_COUNT/$MAX_RETRIES..."
  sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "❌ Server failed to start within timeout"
  exit 1
fi

# Run E2E tests
echo ""
echo "🧪 Running E2E Tests..."
echo "========================"
echo ""

# Run all E2E tests
pnpm exec tsx tests/e2e/api.test.ts
pnpm exec tsx tests/e2e/realtime-websocket.test.ts
pnpm exec tsx tests/e2e/full-integration.test.ts

echo ""
echo "✅ All E2E tests completed!"
echo ""

# Cleanup will run automatically via trap
