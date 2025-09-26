#!/bin/bash
set -e

echo "🚀 Updating VPS with latest changes"
echo "==================================="

# Pull latest changes
echo "📥 Pulling latest changes from Git..."
git pull origin master

if [ $? -ne 0 ]; then
    echo "❌ Git pull failed"
    exit 1
fi

echo "✅ Git pull successful"

# Stop and remove old container
echo ""
echo "🛑 Stopping old container..."
docker stop aethir-checker 2>/dev/null || true
docker rm aethir-checker 2>/dev/null || true

# Build new image
echo ""
echo "🔨 Building new Docker image..."
docker build -t aethir-checker:latest .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed"
    exit 1
fi

echo "✅ Docker image built successfully"

# Start new container
echo ""
echo "🚀 Starting new container..."
docker run --detach --privileged --cgroupns=host \
    --volume=/sys/fs/cgroup:/sys/fs/cgroup \
    --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal \
    --name aethir-checker \
    --restart unless-stopped \
    aethir-checker:latest

if [ $? -ne 0 ]; then
    echo "❌ Failed to start container"
    exit 1
fi

echo "✅ Container started successfully"

# Wait a moment for initialization
echo ""
echo "⏳ Waiting for container to initialize..."
sleep 10

# Test the updated status hook
echo ""
echo "🧪 Testing updated status hook..."
docker exec aethir-checker /usr/lib/node_modules/@deeep-network/riptide/dist/cli.js status --config /root/riptide.config.json --hooks /root/src/hooks.js

echo ""
echo "==================================="
echo "✅ VPS Update Completed Successfully!"
echo "==================================="
