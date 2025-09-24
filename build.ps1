# Aethir Checker Docker Build Script (PowerShell)

Write-Host "🚀 Building Aethir Checker Docker Image..." -ForegroundColor Green

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Build the image
Write-Host "📦 Building Docker image..." -ForegroundColor Yellow
docker build -t aethir-checker:latest .

Write-Host "✅ Build completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To run the container:" -ForegroundColor Cyan
Write-Host "  docker run --detach --privileged --cgroupns=host \`" -ForegroundColor White
Write-Host "    --volume=/sys/fs/cgroup:/sys/fs/cgroup:ro \`" -ForegroundColor White
Write-Host "    --name aethir-checker \`" -ForegroundColor White
Write-Host "    aethir-checker:latest" -ForegroundColor White
Write-Host ""
Write-Host "Or use docker-compose:" -ForegroundColor Cyan
Write-Host "  docker-compose up -d" -ForegroundColor White
Write-Host ""
Write-Host "To access the container:" -ForegroundColor Cyan
Write-Host "  docker exec -it aethir-checker bash" -ForegroundColor White
