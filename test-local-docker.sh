#!/bin/bash
set -e

echo "🐳 Local Docker Testing for Aethir + Riptide"
echo "============================================="

# Configuration
IMAGE_NAME="aethir-checker-local"
CONTAINER_NAME="aethir-test-local"
RIPTIDE_CLI="/usr/lib/node_modules/@deeep-network/riptide/dist/cli.js"
CONFIG_PATH="/root/riptide.config.json"
HOOKS_PATH="/root/src/hooks.js"

# Function to cleanup
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    echo "✅ Cleanup complete"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Step 1: Build the Docker image
echo "🔨 Building Docker image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

echo "✅ Docker image built successfully"

# Step 2: Run the container
echo ""
echo "🚀 Starting container: $CONTAINER_NAME"
docker run --detach --privileged --cgroupns=host \
    --volume=/sys/fs/cgroup:/sys/fs/cgroup \
    --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    "$IMAGE_NAME"

if [ $? -ne 0 ]; then
    echo "❌ Failed to start container"
    exit 1
fi

echo "✅ Container started successfully"

# Step 3: Wait for container to be ready
echo ""
echo "⏳ Waiting for container to initialize (30 seconds)..."
sleep 30

# Step 4: Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container is not running. Checking logs..."
    docker logs "$CONTAINER_NAME"
    exit 1
fi

echo "✅ Container is running"

# Step 5: Test Riptide hooks
echo ""
echo "🧪 Testing Riptide Hooks"
echo "========================="

# Function to run a Riptide command
run_riptide_command() {
    local command=$1
    echo ""
    echo "--- Testing Riptide hook: $command ---"
    docker exec "$CONTAINER_NAME" "$RIPTIDE_CLI" "$command" --config "$CONFIG_PATH" --hooks "$HOOKS_PATH"
    echo ""
    sleep 2
}

# Test individual hooks
run_riptide_command "validate"
run_riptide_command "status"
run_riptide_command "health"
run_riptide_command "heartbeat"
run_riptide_command "ready"
run_riptide_command "probe"
run_riptide_command "metrics"

# Step 6: Check wallet creation
echo ""
echo "🔍 Checking wallet creation..."
docker exec "$CONTAINER_NAME" ls -la /root/wallet.json 2>/dev/null && echo "✅ Wallet file exists" || echo "❌ Wallet file not found"

# Step 7: Check installation service status
echo ""
echo "🔍 Checking installation service status..."
docker exec "$CONTAINER_NAME" systemctl status aethir-installation.service --no-pager -l || echo "⚠️ Service status check failed"

echo ""
echo "============================================="
echo "✅ Local Docker Testing Completed Successfully!"
echo "============================================="
echo ""
echo "To interact with the container manually:"
echo "  docker exec -it $CONTAINER_NAME bash"
echo ""
echo "To view logs:"
echo "  docker logs $CONTAINER_NAME"
echo ""
echo "Container will be cleaned up automatically when this script exits."
