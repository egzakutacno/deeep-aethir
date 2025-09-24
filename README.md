# Aethir Checker Docker Container

This Docker container provides an Ubuntu 22.04 LTS environment with systemd support and the Aethir Checker CLI pre-installed.

## Features

- **Base Image**: Ubuntu 22.04 LTS with systemd support
- **Aethir Checker CLI**: Pre-installed and configured
- **systemd Integration**: Full systemd support for service management
- **Privileged Mode**: Required for systemd to work properly

## Quick Start

### 1. Build the Base Image

```bash
docker build -t aethir-checker:latest .
```

### 2. Run the Container

```bash
docker run --privileged --cgroupns=host \
  --name aethir-checker \
  -v /sys/fs/cgroup:/sys/fs/cgroup \
  --tmpfs /run --tmpfs /run/lock --tmpfs /tmp --tmpfs /var/log/journal \
  -d aethir-checker:latest
```

### 3. Install Aethir Checker

```bash
# Copy the tarball
docker cp files/AethirCheckerCLI-linux-1.0.3.2.tar.gz aethir-checker:/root/

# Extract and install
docker exec aethir-checker bash -c "cd /root && tar -xzvf AethirCheckerCLI-linux-1.0.3.2.tar.gz && cd AethirCheckerCLI-linux && ./install.sh"

# Start the service
docker exec aethir-checker systemctl start aethir-checker
```

## Usage

### Access the Container

```bash
docker exec -it aethir-checker bash
```

### Check Service Status

```bash
# Check if systemd is running
docker exec aethir-checker systemctl status

# Check Aethir Checker service
docker exec aethir-checker systemctl status aethir-checker

# Start the service
docker exec aethir-checker systemctl start aethir-checker

# Stop the service
docker exec aethir-checker systemctl stop aethir-checker
```

### Run Aethir Checker Manually

```bash
# Switch to aethir user
docker exec -it aethir-checker su - aethir

# Run the checker
aethir-checker
```

## Container Requirements

- **Privileged Mode**: Required for systemd to function
- **CGroup Namespace**: Must be set to host
- **Volume Mount**: `/sys/fs/cgroup` must be mounted (read-write)
- **Tmpfs Mounts**: Required for `/run`, `/run/lock`, `/tmp`, and `/var/log/journal`

## Troubleshooting

### Container Won't Start

1. Ensure you're using the `--privileged` flag
2. Check that `--cgroupns=host` is set
3. Verify the cgroup volume is mounted

### Service Issues

1. Check systemd status: `systemctl status`
2. View service logs: `journalctl -u aethir-checker`
3. Check if the binary exists: `which aethir-checker`

### Debug Commands

```bash
# Check running processes
docker exec aethir-checker ps aux

# Check systemd services
docker exec aethir-checker systemctl list-units

# View container logs
docker logs aethir-checker
```

## File Structure

```
/root/
├── AethirCheckerCLI-linux-1.0.3.2.tar.gz  # Original tarball (removed after install)
└── AethirCheckerCLI-linux/                 # Extracted directory (removed after install)

/home/aethir/
└── .aethir/                                # Aethir configuration directory

/usr/local/bin/
├── aethir-checker                          # Aethir Checker binary
└── start-aethir.sh                        # Container startup script

/etc/systemd/system/
└── aethir-checker.service                 # systemd service definition
```

## License

This project uses the Aethir Checker CLI which has its own license terms. Please refer to the Aethir documentation for licensing information.

## Support

For issues related to:
- **Docker Container**: Check this repository
- **Aethir Checker CLI**: Refer to Aethir documentation
- **systemd Issues**: Check Ubuntu systemd documentation
