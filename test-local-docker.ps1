# Local Docker Testing for Aethir + Riptide
Write-Host "🐳 Local Docker Testing for Aethir + Riptide" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Configuration
$IMAGE_NAME = "aethir-checker-local"
$CONTAINER_NAME = "aethir-test-local"
$RIPTIDE_CLI = "/usr/lib/node_modules/@deeep-network/riptide/dist/cli.js"
$CONFIG_PATH = "/root/riptide.config.json"
$HOOKS_PATH = "/root/src/hooks.js"

# Function to cleanup
function Cleanup {
    Write-Host ""
    Write-Host "🧹 Cleaning up..." -ForegroundColor Yellow
    docker stop $CONTAINER_NAME 2>$null
    docker rm $CONTAINER_NAME 2>$null
    Write-Host "✅ Cleanup complete" -ForegroundColor Green
}

# Set trap to cleanup on exit
trap { Cleanup; exit }

try {
    # Step 1: Build the Docker image
    Write-Host "🔨 Building Docker image: $IMAGE_NAME" -ForegroundColor Yellow
    docker build -t $IMAGE_NAME .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Docker image built successfully" -ForegroundColor Green

    # Step 2: Run the container
    Write-Host ""
    Write-Host "🚀 Starting container: $CONTAINER_NAME" -ForegroundColor Yellow
    docker run --detach --privileged --cgroupns=host `
        --volume=/sys/fs/cgroup:/sys/fs/cgroup `
        --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal `
        --name $CONTAINER_NAME `
        --restart unless-stopped `
        $IMAGE_NAME

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start container" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Container started successfully" -ForegroundColor Green

    # Step 3: Wait for container to be ready
    Write-Host ""
    Write-Host "⏳ Waiting for container to initialize (30 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30

    # Step 4: Check if container is running
    $running = docker ps --format "{{.Names}}" | Select-String $CONTAINER_NAME
    if (-not $running) {
        Write-Host "❌ Container is not running. Checking logs..." -ForegroundColor Red
        docker logs $CONTAINER_NAME
        exit 1
    }

    Write-Host "✅ Container is running" -ForegroundColor Green

    # Step 5: Test Riptide hooks
    Write-Host ""
    Write-Host "🧪 Testing Riptide Hooks" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan

    # Function to run a Riptide command
    function Run-RiptideCommand {
        param($command)
        Write-Host ""
        Write-Host "--- Testing Riptide hook: $command ---" -ForegroundColor Yellow
        docker exec $CONTAINER_NAME $RIPTIDE_CLI $command --config $CONFIG_PATH --hooks $HOOKS_PATH
        Write-Host ""
        Start-Sleep -Seconds 2
    }

    # Test individual hooks (only available commands)
    Run-RiptideCommand "validate"
    Run-RiptideCommand "status"
    Run-RiptideCommand "health"
    # Note: heartbeat, ready, probe, metrics are internal hooks, not CLI commands

    # Step 6: Check wallet creation
    Write-Host ""
    Write-Host "🔍 Checking wallet creation..." -ForegroundColor Yellow
    $walletCheck = docker exec $CONTAINER_NAME ls -la /root/wallet.json 2>$null
    if ($walletCheck) {
        Write-Host "✅ Wallet file exists" -ForegroundColor Green
    } else {
        Write-Host "❌ Wallet file not found" -ForegroundColor Red
    }

    # Step 7: Check installation service status
    Write-Host ""
    Write-Host "🔍 Checking installation service status..." -ForegroundColor Yellow
    docker exec $CONTAINER_NAME systemctl status aethir-installation.service --no-pager -l

    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "✅ Local Docker Testing Completed Successfully!" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To interact with the container manually:" -ForegroundColor White
    Write-Host "  docker exec -it $CONTAINER_NAME bash" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To view logs:" -ForegroundColor White
    Write-Host "  docker logs $CONTAINER_NAME" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Container will be cleaned up automatically when this script exits." -ForegroundColor White

} finally {
    Cleanup
}
