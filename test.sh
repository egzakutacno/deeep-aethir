#!/bin/bash

# Aethir Checker Docker Test Script

set -e

echo "🧪 Testing Aethir Checker Docker Container..."

# Check if container is running
if ! docker ps | grep -q aethir-checker; then
    echo "❌ Container 'aethir-checker' is not running."
    echo "Please start the container first with:"
    echo "  docker-compose up -d"
    echo "  or"
    echo "  docker run --detach --privileged --cgroupns=host --volume=/sys/fs/cgroup:/sys/fs/cgroup:ro --name aethir-checker aethir-checker:latest"
    exit 1
fi

echo "✅ Container is running"

# Test 1: Check if systemd is running
echo "🔍 Testing systemd..."
if docker exec aethir-checker systemctl status > /dev/null 2>&1; then
    echo "✅ systemd is running"
else
    echo "❌ systemd is not running"
    exit 1
fi

# Test 2: Check if aethir-checker binary exists
echo "🔍 Testing Aethir Checker binary..."
if docker exec aethir-checker which aethir-checker > /dev/null 2>&1; then
    echo "✅ Aethir Checker binary found"
else
    echo "❌ Aethir Checker binary not found"
    exit 1
fi

# Test 3: Check if service is enabled
echo "🔍 Testing systemd service..."
if docker exec aethir-checker systemctl is-enabled aethir-checker > /dev/null 2>&1; then
    echo "✅ Aethir Checker service is enabled"
else
    echo "❌ Aethir Checker service is not enabled"
fi

# Test 4: Check aethir user
echo "🔍 Testing aethir user..."
if docker exec aethir-checker id aethir > /dev/null 2>&1; then
    echo "✅ aethir user exists"
else
    echo "❌ aethir user does not exist"
    exit 1
fi

# Test 5: Check .aethir directory
echo "🔍 Testing .aethir directory..."
if docker exec aethir-checker test -d /home/aethir/.aethir; then
    echo "✅ .aethir directory exists"
else
    echo "❌ .aethir directory does not exist"
fi

echo ""
echo "🎉 All tests passed! The container is working correctly."
echo ""
echo "To start the Aethir Checker service:"
echo "  docker exec aethir-checker systemctl start aethir-checker"
echo ""
echo "To check service status:"
echo "  docker exec aethir-checker systemctl status aethir-checker"
echo ""
echo "To access the container:"
echo "  docker exec -it aethir-checker bash"
