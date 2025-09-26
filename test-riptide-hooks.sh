#!/bin/bash

# Test script for Riptide hooks in Aethir container
# Run this on your VPS after pulling the latest changes

set -e

echo "🧪 Testing Riptide Hooks in Aethir Container"
echo "=============================================="

# Check if container is running
CONTAINER_NAME="aethir-riptide-test"
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container $CONTAINER_NAME is not running"
    echo "Please start the container first:"
    echo "docker run --privileged --cgroupns=host \\"
    echo "  --name $CONTAINER_NAME \\"
    echo "  -v /sys/fs/cgroup:/sys/fs/cgroup \\"
    echo "  --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal \\"
    echo "  -d aethir-checker:latest"
    exit 1
fi

echo "✅ Container $CONTAINER_NAME is running"

# Test 1: Validate configuration and hooks
echo ""
echo "🔍 Test 1: Validating Riptide configuration and hooks"
echo "----------------------------------------------------"
docker exec $CONTAINER_NAME /usr/lib/node_modules/@deeep-network/riptide/dist/cli.js validate \
  --config /root/riptide.config.json \
  --hooks /root/src/hooks.js

# Test 2: Check service status
echo ""
echo "📊 Test 2: Checking service status"
echo "----------------------------------"
docker exec $CONTAINER_NAME /usr/lib/node_modules/@deeep-network/riptide/dist/cli.js status \
  --config /root/riptide.config.json \
  --hooks /root/src/hooks.js

# Test 3: Health check
echo ""
echo "🏥 Test 3: Running health check"
echo "-------------------------------"
docker exec $CONTAINER_NAME /usr/lib/node_modules/@deeep-network/riptide/dist/cli.js health \
  --config /root/riptide.config.json \
  --hooks /root/src/hooks.js

# Test 4: Check wallet file
echo ""
echo "💰 Test 4: Checking wallet file"
echo "-------------------------------"
if docker exec $CONTAINER_NAME test -f /root/wallet.json; then
    echo "✅ Wallet file exists"
    echo "📄 Wallet contents:"
    docker exec $CONTAINER_NAME cat /root/wallet.json | head -c 100
    echo "..."
else
    echo "❌ Wallet file not found"
fi

# Test 5: Check systemd services
echo ""
echo "⚙️  Test 5: Checking systemd services"
echo "------------------------------------"
echo "Aethir Checker Service:"
docker exec $CONTAINER_NAME systemctl is-active aethir-checker.service || echo "Not active"
echo ""
echo "Riptide Service:"
docker exec $CONTAINER_NAME systemctl is-active aethir-riptide.service || echo "Not active"
echo ""
echo "Wallet Watcher Service:"
docker exec $CONTAINER_NAME systemctl is-active aethir-wallet-watcher.service || echo "Not active"

# Test 6: Check container logs
echo ""
echo "📋 Test 6: Recent container logs"
echo "-------------------------------"
echo "Last 20 lines of Riptide logs:"
docker logs --tail 20 $CONTAINER_NAME

echo ""
echo "🎉 Hook testing complete!"
echo "========================="
echo ""
echo "💡 Additional commands you can run:"
echo "  docker exec $CONTAINER_NAME journalctl -u aethir-riptide.service -f"
echo "  docker exec $CONTAINER_NAME journalctl -u aethir-checker.service -f"
echo "  docker exec $CONTAINER_NAME systemctl status aethir-riptide.service"
