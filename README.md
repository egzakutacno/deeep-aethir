# Aethir Checker Node - Docker Setup

This repository contains the Docker setup for running Aethir checker nodes using systemd-enabled containers.

## Prerequisites

1. Docker installed on your VPS
2. The Aethir checker CLI tar file: `AethirCheckerCLI-linux-1.0.3.2.tar.gz` placed in `/root/` on your VPS

## Quick Setup

Run the setup script:

```bash
python3 aethir_setup.py
```

The script will:
1. Build the Docker image
2. Create and start a container with proper systemd support
3. Copy the Aethir tar file into the container
4. Extract and install the Aethir checker software
5. Drop you into an interactive shell

## Manual Setup

If you prefer to run commands manually:

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

### 3. Copy the Aethir tar file
```bash
docker cp /root/AethirCheckerCLI-linux-1.0.3.2.tar.gz aethir-node:/root/
```

### 4. Install Aethir inside the container
```bash
docker exec aethir-node bash -c 'cd /root && tar -xzvf AethirCheckerCLI-linux-1.0.3.2.tar.gz && cd AethirCheckerCLI-linux && ./install.sh'
```

### 5. Access the container
```bash
docker exec -it aethir-node bash -c 'cd /root/AethirCheckerCLI-linux && bash'
```

## Key Points

- The installation happens **after** container startup when systemd is running
- Uses `--privileged` and `--cgroupns=host` flags for proper systemd support
- The Aethir service will be installed and started automatically
- Container runs systemd as PID 1 for proper service management

## Next Steps

Once the Aethir checker is running, we'll integrate it with the Riptide SDK for NerdNode's container orchestration platform.
