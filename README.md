# Aethir Checker Node with Riptide SDK Integration

A complete Docker containerization solution for the Aethir checker node, integrated with NerdNode's Riptide SDK for seamless orchestration.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Container                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              systemd (PID 1)                            ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │            Riptide Service                          │││
│  │  │  ┌─────────────────────────────────────────────────┐│││
│  │  │  │         Aethir Checker Service                  ││││
│  │  │  │                                                 ││││
│  │  │  │  • Wallet Management                            ││││
│  │  │  │  • License Management                           ││││
│  │  │  │  • Health Monitoring                            ││││
│  │  │  └─────────────────────────────────────────────────┘│││
│  │  │                                                     │││
│  │  │  • Lifecycle Hooks (start/health/heartbeat/stop)   │││
│  │  │  • Interactive Automation                          │││
│  │  │  • Key Extraction & Reporting                      │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker with systemd support
- Container orchestration platform (Nomad/Kubernetes)
- Network access for Aethir blockchain

### Container Requirements
```bash
# Required container flags for systemd support
--privileged
--cgroupns=host
-v /sys/fs/cgroup:/sys/fs/cgroup
```

### Build and Deploy
```bash
# Clone repository
git clone https://github.com/egzakutacno/deeep-aethir.git
cd deeep-aethir

# Build Docker image (from root directory)
docker build --platform linux/amd64 -t aethir-checker:latest .

# Run container
docker run --privileged --cgroupns=host \
  --name aethir-checker \
  -v /sys/fs/cgroup:/sys/fs/cgroup \
  -d aethir-checker:latest
```

**Note**: The Dockerfile is in the root directory and builds the complete service with systemd + Riptide + Aethir integration.

## 📊 Service Integration

### Health Monitoring
```bash
# Check service health
docker exec <container> systemctl is-active riptide
# Returns: active/inactive/failed
```

### Data Collection
The service automatically reports via Riptide's heartbeat hook:
- **Wallet Keys**: Private and public keys for orchestrator storage
- **License Status**: Current license counts and pending approvals
- **Service Health**: Real-time service status and metrics

### Heartbeat Response Format
```json
{
  "status": "running",
  "walletKeys": {
    "privateKey": "LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQp...",
    "publicKey": "fb65da1e0cff06dc86cad9ebfbf6260a43f25442"
  },
  "licenseSummary": {
    "checking": 0,
    "ready": 0,
    "offline": 0,
    "banned": 0,
    "pending": 0,
    "totalDelegated": 0
  },
  "serviceStatus": "active"
}
```

## 🔧 Technical Details

### Base Image
- **Image**: `eniocarboni/docker-ubuntu-systemd:jammy`
- **Purpose**: Provides systemd as PID 1 (required by Aethir)
- **Source**: [GitHub Repository](https://github.com/eniocarboni/docker-ubuntu-systemd)

### Service Management
- **Init System**: systemd (PID 1)
- **Riptide Service**: Runs as systemd service
- **Aethir Management**: Via systemctl commands
- **Automation**: Interactive CLI handling via Node.js spawn

### Key Features
- ✅ **Automated Setup**: Terms acceptance and wallet creation
- ✅ **Key Extraction**: Multi-line base64 private key parsing
- ✅ **License Management**: Auto-approval of pending licenses
- ✅ **Buffer Overflow Protection**: Streaming output parsing
- ✅ **Error Handling**: Comprehensive logging and recovery
- ✅ **Health Monitoring**: Real-time service status

## 📁 Repository Structure

```
aethir/
├── README.md                           # This file
├── DEPLOYMENT.md                       # Deployment guide for orchestrators
├── API.md                             # API specification and data formats
├── ARCHITECTURE.md                     # System architecture documentation
├── NERDNODE_INTEGRATION.md             # Integration summary for NerdNode
├── Dockerfile                         # Main container definition (root level)
├── package.json                       # Root package.json
├── riptide.config.json                # Root Riptide configuration
├── src/hooks.ts                       # Root hooks source
├── tsconfig.json                      # Root TypeScript configuration
├── files/
│   └── AethirCheckerCLI-linux-1.0.3.2.tar.gz  # Aethir binary
└── aethir-checker/
    ├── src/hooks.ts                   # Riptide lifecycle hooks (duplicate)
    ├── dist/hooks.js                  # Compiled hooks
    ├── package.json                   # Node.js dependencies
    ├── riptide.config.json            # Riptide configuration (duplicate)
    ├── tsconfig.json                  # TypeScript configuration (duplicate)
    ├── Dockerfile                     # Alternative Dockerfile
    └── AethirCheckerCLI-linux-1.0.3.2.tar.gz  # Aethir binary (duplicate)
```

**Note**: The main Dockerfile is in the root directory. The `aethir-checker/` subdirectory contains alternative configurations and duplicates for development purposes.

## 🔍 Validation & Testing

### Manual Testing Commands
```bash
# Test health hook
docker exec <container> bash -c "cd /riptide && node -e \"
const hooks = require('./hooks.js');
hooks.health({logger: console, utils: {}}).then(result => {
  console.log('Health:', result);
});
\""

# Test heartbeat hook
docker exec <container> bash -c "cd /riptide && node -e \"
const hooks = require('./hooks.js');
hooks.heartbeat({logger: console, utils: {}}).then(result => {
  console.log('Heartbeat:', JSON.stringify(result, null, 2));
});
\""

# Check wallet files
docker exec <container> ls -la ~/.aethir*

# Check service status
docker exec <container> systemctl status aethir-checker
```

### Expected Outputs
- **Health**: `true` (service active)
- **Heartbeat**: JSON with wallet keys and license status
- **Wallet Files**: Present in `~/.aethir/` directory
- **Service**: `active (running)` status

## 🚨 Troubleshooting

### Common Issues
1. **systemd not PID 1**: Ensure `--privileged --cgroupns=host` flags
2. **Wallet not created**: Check container logs for setup errors
3. **Service inactive**: Verify Aethir installation completed
4. **Buffer overflow**: Fixed with streaming output parsing

### Debug Commands
```bash
# Check container processes
docker exec <container> ps aux | head -5

# Check systemd status
docker exec <container> systemctl status

# Check Riptide service
docker exec <container> systemctl status riptide

# Check container logs
docker logs <container>
```

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review container logs: `docker logs <container>`
3. Verify systemd integration: `docker exec <container> systemctl status`

## 📄 License

This project integrates with:
- **Aethir Checker**: Aethir's proprietary software
- **Riptide SDK**: NerdNode's orchestration library
- **systemd**: System service management