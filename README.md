# Aethir Checker Node - Docker Image

This repository contains a complete Docker image with Aethir checker node pre-installed and ready to run.

## Quick Start

### 1. Build the Docker image
```bash
docker build -t aethir-checker .
```

### 2. Run the container with systemd support
```bash
docker run --privileged --cgroupns=host \
    --name aethir-node \
    -v /sys/fs/cgroup:/sys/fs/cgroup \
    -d aethir-checker
```

### 3. Access the container
```bash
docker exec -it aethir-node bash -c 'cd /opt/aethir-checker && bash'
```

## What's Included

- **Base Image**: Ubuntu 22.04 LTS with systemd support
- **Aethir Checker CLI**: Pre-installed and configured
- **Systemd Service**: Aethir checker service ready to run
- **Automatic Setup**: Installation happens at container startup

## Key Features

- **Complete Image**: Everything included - no external dependencies
- **Systemd Integration**: Proper service management with systemd
- **Ready to Run**: Aethir checker starts automatically
- **Container Flags**: Uses proper `--privileged` and `--cgroupns=host` for systemd

## Container Management

### Check service status
```bash
docker exec aethir-node systemctl status aethir-checker
```

### View logs
```bash
docker exec aethir-node journalctl -u aethir-checker -f
```

### Stop container
```bash
docker stop aethir-node
```

## Next Steps

This image is ready for integration with the Riptide SDK for NerdNode's container orchestration platform.
