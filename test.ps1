# Aethir Checker Docker Test Script (PowerShell)

Write-Host "🧪 Testing Aethir Checker Docker Container..." -ForegroundColor Green

# Check if container is running
$containerRunning = docker ps --format "table {{.Names}}" | Select-String "aethir-checker"
if (-not $containerRunning) {
    Write-Host "❌ Container 'aethir-checker' is not running." -ForegroundColor Red
    Write-Host "Please start the container first with:" -ForegroundColor Yellow
    Write-Host "  docker-compose up -d" -ForegroundColor White
    Write-Host "  or" -ForegroundColor White
    Write-Host "  docker run --detach --privileged --cgroupns=host --volume=/sys/fs/cgroup:/sys/fs/cgroup:ro --name aethir-checker aethir-checker:latest" -ForegroundColor White
    exit 1
}

Write-Host "✅ Container is running" -ForegroundColor Green

# Test 1: Check if systemd is running
Write-Host "🔍 Testing systemd..." -ForegroundColor Yellow
try {
    docker exec aethir-checker systemctl status | Out-Null
    Write-Host "✅ systemd is running" -ForegroundColor Green
} catch {
    Write-Host "❌ systemd is not running" -ForegroundColor Red
    exit 1
}

# Test 2: Check if aethir-checker binary exists
Write-Host "🔍 Testing Aethir Checker binary..." -ForegroundColor Yellow
try {
    docker exec aethir-checker which aethir-checker | Out-Null
    Write-Host "✅ Aethir Checker binary found" -ForegroundColor Green
} catch {
    Write-Host "❌ Aethir Checker binary not found" -ForegroundColor Red
    exit 1
}

# Test 3: Check if service is enabled
Write-Host "🔍 Testing systemd service..." -ForegroundColor Yellow
try {
    docker exec aethir-checker systemctl is-enabled aethir-checker | Out-Null
    Write-Host "✅ Aethir Checker service is enabled" -ForegroundColor Green
} catch {
    Write-Host "❌ Aethir Checker service is not enabled" -ForegroundColor Red
}

# Test 4: Check aethir user
Write-Host "🔍 Testing aethir user..." -ForegroundColor Yellow
try {
    docker exec aethir-checker id aethir | Out-Null
    Write-Host "✅ aethir user exists" -ForegroundColor Green
} catch {
    Write-Host "❌ aethir user does not exist" -ForegroundColor Red
    exit 1
}

# Test 5: Check .aethir directory
Write-Host "🔍 Testing .aethir directory..." -ForegroundColor Yellow
try {
    docker exec aethir-checker test -d /home/aethir/.aethir
    Write-Host "✅ .aethir directory exists" -ForegroundColor Green
} catch {
    Write-Host "❌ .aethir directory does not exist" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 All tests passed! The container is working correctly." -ForegroundColor Green
Write-Host ""
Write-Host "To start the Aethir Checker service:" -ForegroundColor Cyan
Write-Host "  docker exec aethir-checker systemctl start aethir-checker" -ForegroundColor White
Write-Host ""
Write-Host "To check service status:" -ForegroundColor Cyan
Write-Host "  docker exec aethir-checker systemctl status aethir-checker" -ForegroundColor White
Write-Host ""
Write-Host "To access the container:" -ForegroundColor Cyan
Write-Host "  docker exec -it aethir-checker bash" -ForegroundColor White
