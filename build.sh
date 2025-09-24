#!/bin/bash

# Aethir Checker Docker Build Script

set -e

echo "🚀 Building Aethir Checker Docker Image..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build the image
echo "📦 Building Docker image..."
docker build -t aethir-checker:latest .

echo "✅ Build completed successfully!"
echo ""
echo "To run the container:"
echo "  docker run --detach --privileged --cgroupns=host \\"
echo "    --volume=/sys/fs/cgroup:/sys/fs/cgroup:ro \\"
echo "    --name aethir-checker \\"
echo "    aethir-checker:latest"
echo ""
echo "Or use docker-compose:"
echo "  docker-compose up -d"
echo ""
echo "To access the container:"
echo "  docker exec -it aethir-checker bash"
