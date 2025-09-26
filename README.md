# Aethir Checker with NerdNode Integration

This repository contains a Docker containerized Aethir Checker service integrated with NerdNode's Riptide SDK for orchestration and management.

## Overview

The Aethir Checker is a service that monitors and validates Aethir network licenses. This implementation integrates with NerdNode's orchestration system using the Riptide SDK, allowing NerdNode to manage the Aethir workload lifecycle while maintaining systemd as PID 1 for Aethir compatibility.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container                        │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   systemd (PID1)│    │        Riptide SDK             │ │
│  │                 │    │                                 │ │
│  │ ┌─────────────┐ │    │ ┌─────────────────────────────┐ │ │
│  │ │ Aethir CLI  │ │    │ │     Hooks (src/hooks.js)   │ │ │
│  │ │ Installation│ │    │ │                             │ │ │
│  │ │ & Wallet    │ │    │ │ • heartbeat() - sends keys │ │ │
│  │ │ Creation    │ │    │ │ • health() - service check │ │ │
│  │ └─────────────┘ │    │ │ • status() - detailed info │ │ │
│  │                 │    │ │ • start/stop() - lifecycle │ │ │
│  │ ┌─────────────┐ │    │ └─────────────────────────────┘ │ │
│  │ │Wallet Watcher│ │    │                                 │ │
│  │ │Service      │ │    │ ┌─────────────────────────────┐ │ │
│  │ │(starts Riptide)│    │ │   Riptide Manager Service  │ │ │
│  │ └─────────────┘ │    │ │   (disabled by default)    │ │ │
│  └─────────────────┘    │ └─────────────────────────────┘ │ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │   NerdNode          │
                    │   Orchestrator      │
                    │                     │
                    │ • Receives wallet   │
                    │   keys on first     │
                    │   heartbeat         │
                    │ • Manages lifecycle │
                    │ • Monitors health   │
                    └─────────────────────┘
```

## Key Features

- **systemd as PID 1**: Maintains Aethir CLI compatibility
- **Automatic Wallet Creation**: Creates and manages Aethir wallet keys
- **Riptide Integration**: Full lifecycle management via NerdNode
- **Secure Key Transmission**: Sends wallet keys only on first heartbeat
- **Health Monitoring**: Comprehensive health checks and status reporting
- **Service Orchestration**: Proper startup sequence and dependency management

## Service Flow

1. **Container Startup**: systemd starts as PID 1
2. **Aethir Installation**: Installs Aethir CLI and creates wallet (~1 minute)
3. **Wallet Detection**: Wallet watcher detects wallet.json creation
4. **Riptide Activation**: Starts Riptide manager service
5. **First Heartbeat**: Sends wallet keys to NerdNode orchestrator
6. **Ongoing Operation**: Regular heartbeats with status updates

## Files Structure

### Core Files
- `Dockerfile` - Container definition with systemd and Riptide
- `src/hooks.js` - Riptide SDK hooks for NerdNode integration
- `riptide.config.json` - Riptide configuration
- `aethir_automation.py` - Python automation for Aethir CLI interaction

### Systemd Services
- `aethir-installation.service` - Installs Aethir and creates wallet
- `aethir-wallet-watcher.service` - Monitors wallet creation and starts Riptide
- `aethir-riptide-manager.service` - Riptide service (disabled by default)

### Scripts
- `start-riptide-after-wallet.sh` - Wallet watcher script
- `automate_aethir.sh` - Legacy automation script (backup)

### Assets
- `files/AethirCheckerCLI-linux-1.0.3.2.tar.gz` - Aethir CLI binary

## Riptide Hooks

The `src/hooks.js` file implements the following Riptide hooks:

### `heartbeat()`
- **Purpose**: Sends periodic status updates to NerdNode
- **First Heartbeat**: Includes full wallet keys (private + public)
- **Subsequent Heartbeats**: Sends confirmation only
- **Frequency**: Every 30 seconds

### `health()`
- **Purpose**: Health check for service monitoring
- **Returns**: Boolean indicating service health
- **Checks**: Aethir CLI accessibility and wallet status

### `status()`
- **Purpose**: Detailed service status information
- **Returns**: Comprehensive status object with system metrics
- **Includes**: Wallet info, service status, system metrics

### `start()`
- **Purpose**: Service startup verification
- **Returns**: Success/failure status
- **Checks**: Aethir service is running

### `stop()`
- **Purpose**: Service shutdown
- **Actions**: Stops Aethir services and cleans up processes

### Additional Hooks
- `ready()` - Service readiness check
- `probe()` - Liveness probe
- `metrics()` - System metrics collection
- `validate()` - Configuration validation

## Wallet Key Management

### Key Generation
- Aethir CLI generates wallet keys during installation
- Keys are saved to `/root/wallet.json`
- Format: `{"private_key": "...", "public_key": "..."}`

### Key Transmission
- **First Heartbeat**: Full keys sent to NerdNode
- **Security**: Keys sent only once, then confirmation only
- **Flag Management**: Uses `/tmp/wallet_sent_to_orchestrator` flag

### Key Format
- **Private Key**: Base64-encoded RSA private key
- **Public Key**: Hexadecimal public key hash

## Docker Usage

### Build
```bash
docker build -t aethir-checker:latest .
```

### Run
```bash
docker run --detach --privileged --cgroupns=host \
  --volume=/sys/fs/cgroup:/sys/fs/cgroup \
  --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal \
  --name aethir-checker \
  --restart unless-stopped \
  aethir-checker:latest
```

### Required Docker Flags
- `--privileged`: Required for systemd
- `--cgroupns=host`: Systemd cgroup management
- `--volume=/sys/fs/cgroup:/sys/fs/cgroup`: Cgroup filesystem
- `--tmpfs` mounts: Required for systemd journal and runtime

## NerdNode Integration

### Riptide Configuration
The service uses Riptide SDK with the following configuration:
- **Service Name**: `aethir-checker`
- **Health Port**: 3000
- **Heartbeat Interval**: 30 seconds
- **Hooks**: Full lifecycle management

### API Endpoints
- **Health Check**: `http://localhost:3000/health`
- **Status**: Available via Riptide hooks
- **Heartbeat**: Automatic transmission to NerdNode

### Environment Variables
- `NODE_ENV=production`
- Standard systemd environment

## Monitoring and Logging

### Logs
- **systemd Journal**: `journalctl -u aethir-*`
- **Container Logs**: `docker logs aethir-checker`
- **Riptide Logs**: `journalctl -u aethir-riptide-manager.service`

### Health Checks
- **Service Status**: `systemctl status aethir-riptide-manager.service`
- **Wallet Status**: Check `/root/wallet.json` existence
- **Riptide Health**: Via health hook

## Troubleshooting

### Common Issues
1. **Container won't start**: Check systemd flags and cgroup mounts
2. **Wallet not created**: Check Aethir installation logs
3. **Riptide not starting**: Verify wallet watcher service
4. **Keys not sent**: Check flag file and first heartbeat

### Debug Commands
```bash
# Check service status
docker exec aethir-checker systemctl status aethir-*

# Check wallet
docker exec aethir-checker ls -la /root/wallet.json

# Test heartbeat manually
docker exec aethir-checker node -e "require('/root/hooks.js').heartbeat({logger: console, utils: {...}})"
```

## Security Considerations

- **Private Keys**: Transmitted only on first heartbeat
- **Flag Management**: Prevents key re-transmission
- **Service Isolation**: Riptide runs as subprocess under systemd
- **Container Security**: Privileged mode required for systemd

## Dependencies

- **Base Image**: `eniocarboni/docker-ubuntu-systemd:jammy`
- **Node.js**: v22 (for Riptide SDK)
- **Python**: 3.x (for Aethir automation)
- **Riptide SDK**: `@deeep-network/riptide@latest`

## License

This project integrates with Aethir Checker CLI and NerdNode Riptide SDK. Please refer to their respective licenses.

## Support

For issues related to:
- **Aethir CLI**: Contact Aethir support
- **Riptide SDK**: Contact NerdNode support
- **Integration**: Check this repository's issues