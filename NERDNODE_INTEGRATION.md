# NerdNode Integration Guide

This document provides specific integration details for NerdNode orchestrator.

## Quick Start

1. **Deploy Container**:
   ```bash
   docker run --detach --privileged --cgroupns=host \
     --volume=/sys/fs/cgroup:/sys/fs/cgroup \
     --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal \
     --name aethir-checker \
     --restart unless-stopped \
     aethir-checker:latest
   ```

2. **Monitor Integration**:
   ```bash
   # Watch container logs
   docker logs -f aethir-checker
   
   # Check Riptide service
   docker exec aethir-checker systemctl status aethir-riptide-manager.service
   ```

## Riptide Hooks API

### Heartbeat Hook
**Purpose**: Sends wallet keys to NerdNode on first heartbeat, then status updates.

**First Heartbeat Payload**:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-26T11:22:54.542Z",
  "service": "aethir-checker",
  "wallet_created": true,
  "uptime": 0.053867879,
  "memory_usage": { "rss": 47218688, "heapTotal": 5873664, "heapUsed": 4709008 },
  "platform": "linux",
  "arch": "x64",
  "node_version": "v22.20.0",
  "wallet": {
    "private_key": "LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlCT2dJQkFBSkJBTURObjlSUWdCL2VPUVVwdXpLL0IwOW1kUnpPVndoUUNmVm0yaVBJVDdzTFpYL21XTW1OClBzL3BUZEhRUFU1MDE3akJvbEVLaW5LZVNDUWJ1TjdIT05zQ0F3RUFBUUpCQUwvOXd2UGNlY25DTTR1MW82a0QKMnhheEUxdnRDWFBJcURJTUNwdHBSQ1FmbWFwbHpQcGRXTVlaKzAyTU5xeEhhNE5FUE9ZQ1J2VjFNTlZwN1UxTApiK2tDSVFEZXI2RG4zZFdOOXN6a0R6Ui9lVUJ4elBIVnpGZnNwSWxTZjZ4S0dWSm9Kd0loQU4ybGpSV0JXaHN0CjRybGluUnNUNEtFa3ZqUjBHWng1NjJhMVNjYWFsZ1l0QWlCL2xVZ3ZFQjNHVkZ4WFhZN0thZ0hPTVlsczRNS1AKUmtXWENxYi9YVHFsaVFJZ05OZ0ltQXo3OTZqcitqa0pyZkFDU1VraVZBMHVJZ0ZyWDFSdm4zc3hzNDBDSUNRbQpCSHJzM0htdm5hV0NEWW5RTkFlZm9BdHZ3TDJsQ0VpN3BicFB3V1VOCi0tLS0tRU5EIFJTQSBQUklWQVRFIEtFWS0tLS0tCg==",
    "public_key": "e16cd50036955032ed755f572330b76a9ffad5ce",
    "first_send": true
  }
}
```

**Subsequent Heartbeat Payload**:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-26T11:23:24.542Z",
  "service": "aethir-checker",
  "wallet_created": true,
  "uptime": 30.053867879,
  "memory_usage": { "rss": 47218688, "heapTotal": 5873664, "heapUsed": 4709008 },
  "platform": "linux",
  "arch": "x64",
  "node_version": "v22.20.0",
  "wallet": {
    "exists": true,
    "sent_previously": true
  }
}
```

### Health Hook
**Purpose**: Service health check for monitoring.

**Returns**: `true` if healthy, `false` if unhealthy.

**Health Check Logic**:
- Verifies Aethir CLI accessibility
- Checks wallet existence
- Validates service status

### Status Hook
**Purpose**: Detailed service status for monitoring dashboard.

**Returns**: Comprehensive status object including:
- Service health status
- Wallet information
- System metrics (CPU, memory, uptime)
- Aethir license status
- Service dependencies

### Start Hook
**Purpose**: Service startup verification.

**Returns**: `{ success: true }` if Aethir service is running.

### Stop Hook
**Purpose**: Graceful service shutdown.

**Actions**:
- Stops Aethir Checker service
- Stops installation service
- Kills remaining Aethir processes
- Preserves Riptide service

## Service Lifecycle

### 1. Container Startup (0-10 seconds)
- systemd starts as PID 1
- Aethir installation service starts
- Wallet watcher service starts (waiting for wallet)

### 2. Aethir Installation (10-70 seconds)
- Downloads and installs Aethir CLI
- Creates wallet.json with private/public keys
- Installation service completes

### 3. Wallet Detection (70-75 seconds)
- Wallet watcher detects wallet.json
- Resets wallet sent flag
- Starts Riptide manager service

### 4. Riptide Activation (75+ seconds)
- Riptide manager starts
- First heartbeat sent with wallet keys
- Regular heartbeats every 30 seconds

## Configuration

### Riptide Config (`riptide.config.json`)
```json
{
  "service": {
    "name": "aethir-checker",
    "version": "1.0.0",
    "description": "Aethir Checker service with Riptide integration"
  },
  "logging": {
    "level": "info"
  },
  "health": {
    "port": 3000
  },
  "heartbeat": {
    "interval": 30,
    "enabled": true
  }
}
```

### Environment Variables
- `NODE_ENV=production`
- Standard systemd environment variables

## Monitoring

### Key Metrics
- **Wallet Status**: `wallet_created` boolean
- **Service Health**: `status` field
- **Uptime**: `uptime` in seconds
- **Memory Usage**: `memory_usage` object
- **Aethir Status**: Available in status hook

### Log Levels
- **Info**: Normal operation, heartbeat preparation
- **Warn**: Non-critical issues, fallback status
- **Error**: Critical failures, service issues
- **Debug**: Detailed debugging information

### Health Check Endpoints
- **Riptide Health**: `http://localhost:3000/health`
- **Service Status**: Via status hook
- **Systemd Status**: `systemctl status aethir-*`

## Troubleshooting

### Common Issues

#### 1. Container Won't Start
**Symptoms**: Container exits immediately
**Solution**: Check Docker run command includes all required flags
```bash
# Verify required flags
docker run --detach --privileged --cgroupns=host \
  --volume=/sys/fs/cgroup:/sys/fs/cgroup \
  --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal \
  --name aethir-checker \
  --restart unless-stopped \
  aethir-checker:latest
```

#### 2. Wallet Not Created
**Symptoms**: No wallet.json after 2 minutes
**Solution**: Check Aethir installation logs
```bash
docker exec aethir-checker journalctl -u aethir-installation.service
```

#### 3. Riptide Not Starting
**Symptoms**: No Riptide logs after wallet creation
**Solution**: Check wallet watcher service
```bash
docker exec aethir-checker journalctl -u aethir-wallet-watcher.service
```

#### 4. Keys Not Sent
**Symptoms**: Heartbeat shows `sent_previously: true` on first run
**Solution**: Reset wallet sent flag
```bash
docker exec aethir-checker rm -f /tmp/wallet_sent_to_orchestrator
```

### Debug Commands

#### Check Service Status
```bash
# All Aethir services
docker exec aethir-checker systemctl status aethir-*

# Specific service
docker exec aethir-checker systemctl status aethir-riptide-manager.service
```

#### Test Heartbeat Manually
```bash
docker exec aethir-checker node -e "
const hooks = require('/root/hooks.js');
const utils = {
  fileExists: async (path) => require('fs').existsSync(path),
  execCommand: async (cmd, opts) => {
    const {exec} = require('child_process');
    return new Promise((resolve) => {
      exec(cmd, opts, (error, stdout, stderr) => {
        resolve({exitCode: error ? error.code : 0, stdout: stdout, stderr: stderr});
      });
    });
  }
};
hooks.heartbeat({logger: console, utils}).then(console.log).catch(console.error);
"
```

#### Check Wallet
```bash
# Check wallet exists
docker exec aethir-checker ls -la /root/wallet.json

# View wallet content
docker exec aethir-checker cat /root/wallet.json
```

#### View Logs
```bash
# Container logs
docker logs aethir-checker

# Riptide logs
docker exec aethir-checker journalctl -u aethir-riptide-manager.service -f

# Installation logs
docker exec aethir-checker journalctl -u aethir-installation.service
```

## Security Notes

### Wallet Key Security
- **Private Key**: Base64-encoded RSA private key
- **Public Key**: Hexadecimal public key hash
- **Transmission**: Sent only on first heartbeat
- **Storage**: Stored in `/root/wallet.json` (container filesystem)

### Service Security
- **Privileged Mode**: Required for systemd functionality
- **Cgroup Access**: Required for systemd process management
- **Tmpfs Mounts**: Required for systemd journal and runtime

### Network Security
- **Health Port**: 3000 (internal to container)
- **No External Ports**: Service communicates via Riptide SDK
- **API Calls**: Outbound to NerdNode orchestrator only

## Performance

### Resource Usage
- **Memory**: ~50-100MB (Node.js + Aethir CLI)
- **CPU**: Low usage during normal operation
- **Disk**: ~200MB (Aethir CLI + dependencies)

### Timing
- **Startup**: 1-2 minutes (Aethir installation)
- **Heartbeat**: Every 30 seconds
- **Health Check**: On-demand via Riptide

### Scaling
- **Single Instance**: One Aethir Checker per container
- **Multiple Containers**: Deploy multiple containers for scaling
- **Resource Limits**: Set appropriate Docker resource limits

## Integration Checklist

- [ ] Docker container deployed with required flags
- [ ] Riptide service starts after wallet creation
- [ ] First heartbeat includes wallet keys
- [ ] Subsequent heartbeats send confirmation only
- [ ] Health checks return proper status
- [ ] Service can be started/stopped via Riptide
- [ ] Logs are accessible and informative
- [ ] Monitoring metrics are available
- [ ] Error handling works correctly
- [ ] Service recovers from failures

## Support

For integration issues:
1. Check container logs: `docker logs aethir-checker`
2. Verify service status: `docker exec aethir-checker systemctl status aethir-*`
3. Test heartbeat manually (see debug commands)
4. Check wallet creation: `docker exec aethir-checker ls -la /root/wallet.json`
5. Review this documentation for troubleshooting steps