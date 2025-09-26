# Update VPS with latest changes
Write-Host "🚀 Updating VPS with latest changes" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

try {
    # Pull latest changes
    Write-Host "📥 Pulling latest changes from Git..." -ForegroundColor Yellow
    git pull origin master

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Git pull failed" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Git pull successful" -ForegroundColor Green

    # Stop and remove old container
    Write-Host ""
    Write-Host "🛑 Stopping old container..." -ForegroundColor Yellow
    docker stop aethir-checker 2>$null
    docker rm aethir-checker 2>$null

    # Build new image
    Write-Host ""
    Write-Host "🔨 Building new Docker image..." -ForegroundColor Yellow
    docker build -t aethir-checker:latest .

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker build failed" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Docker image built successfully" -ForegroundColor Green

    # Start new container
    Write-Host ""
    Write-Host "🚀 Starting new container..." -ForegroundColor Yellow
    docker run --detach --privileged --cgroupns=host `
        --volume=/sys/fs/cgroup:/sys/fs/cgroup `
        --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal `
        --name aethir-checker `
        --restart unless-stopped `
        aethir-checker:latest

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start container" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Container started successfully" -ForegroundColor Green

    # Wait a moment for initialization
    Write-Host ""
    Write-Host "⏳ Waiting for container to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10

    # Test the updated status hook
    Write-Host ""
    Write-Host "🧪 Testing updated status hook..." -ForegroundColor Yellow
    docker exec aethir-checker /usr/lib/node_modules/@deeep-network/riptide/dist/cli.js status --config /root/riptide.config.json --hooks /root/src/hooks.js

    Write-Host ""
    Write-Host "===================================" -ForegroundColor Cyan
    Write-Host "✅ VPS Update Completed Successfully!" -ForegroundColor Green
    Write-Host "===================================" -ForegroundColor Cyan

} catch {
    Write-Host "❌ Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
