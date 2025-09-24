# Aethir Checker Deployment Guide for Orchestrators

This document provides comprehensive deployment instructions for integrating the Aethir Checker service into container orchestration platforms.

## 🎯 Overview

The Aethir Checker service is a fully containerized solution that:
- Runs with systemd as PID 1 (required by Aethir)
- Integrates with NerdNode's Riptide SDK
- Provides automated wallet setup and key extraction
- Reports status via heartbeat hooks
- Manages licenses automatically

## 🏗️ Architecture Requirements

### Container Prerequisites
```yaml
# Required for systemd support
privileged: true
cgroupns: host
volumes:
  - "/sys/fs/cgroup:/sys/fs/cgroup:ro"
```

### Service Dependencies
- **Base Image**: `eniocarboni/docker-ubuntu-systemd:jammy`
- **Init System**: systemd (PID 1)
- **Runtime**: Riptide SDK as systemd service
- **Target Service**: Aethir checker managed via systemctl

## 🚀 Deployment Options

### Option 1: Direct Docker Deployment
```bash
docker run --privileged --cgroupns=host \
  --name aethir-checker \
  -v /sys/fs/cgroup:/sys/fs/cgroup \
  -d egzakutacno/aethir-checker:latest
```

### Option 2: Docker Compose
```yaml
version: '3.8'
services:
  aethir-checker:
    image: egzakutacno/aethir-checker:latest
    privileged: true
    cgroupns: host
    volumes:
      - "/sys/fs/cgroup:/sys/fs/cgroup:ro"
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

### Option 3: Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aethir-checker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: aethir-checker
  template:
    metadata:
      labels:
        app: aethir-checker
    spec:
      containers:
      - name: aethir-checker
        image: egzakutacno/aethir-checker:latest
        securityContext:
          privileged: true
        volumeMounts:
        - name: cgroup
          mountPath: /sys/fs/cgroup
          readOnly: true
      volumes:
      - name: cgroup
        hostPath:
          path: /sys/fs/cgroup
      hostNetwork: false
```

### Option 4: Hashicorp Nomad Job
```hcl
job "aethir-checker" {
  datacenters = ["dc1"]
  type = "service"

  group "aethir-checker" {
    count = 1

    task "aethir-checker" {
      driver = "docker"

      config {
        image = "egzakutacno/aethir-checker:latest"
        privileged = true
        volumes = [
          "/sys/fs/cgroup:/sys/fs/cgroup:ro"
        ]
      }

      resources {
        cpu    = 1000
        memory = 2048
      }
    }
  }
}
```

## 📊 Orchestrator Integration

### Health Check Configuration
```yaml
healthCheck:
  command: ["systemctl", "is-active", "riptide"]
  interval: 30s
  timeout: 10s
  retries: 3
  expectedOutput: "active"
```

### Service Discovery
```yaml
serviceDiscovery:
  name: "aethir-checker"
  port: 0  # No external ports exposed
  healthCheck: "/health"
  tags:
    - "aethir"
    - "blockchain"
    - "checker-node"
```

### Data Collection
```yaml
dataCollection:
  heartbeat:
    endpoint: "/heartbeat"
    interval: 30s
    timeout: 15s
  metrics:
    - wallet_keys
    - license_status
    - service_health
    - uptime
```

## 🔧 Configuration Management

### Environment Variables
```yaml
environment:
  # Riptide Configuration
  RIPTIDE_LOG_LEVEL: "info"
  RIPTIDE_ENVIRONMENT: "production"
  
  # Aethir Configuration (if needed)
  AETHIR_NETWORK: "mainnet"
  AETHIR_DATA_DIR: "/opt/aethir-checker"
```

### Secrets Management
```yaml
secrets:
  # Wallet backup (if needed)
  - name: "wallet-backup"
    mountPath: "/backup"
    readOnly: true
  
  # API keys (if needed)
  - name: "api-keys"
    envVar: "AETHIR_API_KEY"
```

## 📈 Monitoring & Observability

### Prometheus Metrics
```yaml
monitoring:
  prometheus:
    enabled: true
    port: 9090
    path: "/metrics"
    scrape_interval: 30s
```

### Logging Configuration
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "3"
  format: "json"
  fields:
    service: "aethir-checker"
    component: "riptide"
```

### Alerting Rules
```yaml
alerts:
  - name: "AethirCheckerDown"
    condition: "service_status != 'active'"
    severity: "critical"
    action: "restart_service"
  
  - name: "WalletKeysMissing"
    condition: "wallet_keys.private_key == null"
    severity: "warning"
    action: "check_logs"
  
  - name: "LicensePending"
    condition: "license_summary.pending > 0"
    severity: "info"
    action: "auto_approve"
```

## 🔄 Lifecycle Management

### Startup Sequence
1. Container starts with systemd as PID 1
2. Riptide service starts automatically
3. Aethir checker setup begins (wallet creation)
4. Service becomes ready for operation

### Shutdown Sequence
1. Orchestrator sends stop signal
2. Riptide gracefully stops Aethir service
3. Wallet files are preserved
4. Container exits cleanly

### Restart Policy
```yaml
restartPolicy:
  type: "unless-stopped"
  maxRetries: 3
  backoffDelay: "30s"
  maxBackoffDelay: "5m"
```

## 🧪 Testing & Validation

### Pre-deployment Tests
```bash
# Test container startup
docker run --privileged --cgroupns=host \
  -v /sys/fs/cgroup:/sys/fs/cgroup \
  --rm aethir-checker:latest \
  timeout 60s bash -c "systemctl status riptide"

# Test health endpoint
docker exec <container> systemctl is-active riptide

# Test heartbeat data
docker exec <container> curl -s http://localhost:3000/heartbeat
```

### Validation Checklist
- [ ] Container starts successfully
- [ ] systemd is PID 1
- [ ] Riptide service is active
- [ ] Aethir checker service is running
- [ ] Wallet files are created
- [ ] Heartbeat returns valid data
- [ ] Health check passes
- [ ] Logs show no errors

## 🚨 Troubleshooting

### Common Deployment Issues

#### Issue: Container fails to start
```bash
# Check systemd support
docker run --privileged --cgroupns=host \
  -v /sys/fs/cgroup:/sys/fs/cgroup \
  --rm eniocarboni/docker-ubuntu-systemd:jammy \
  systemctl status
```

#### Issue: Service not responding
```bash
# Check service status
docker exec <container> systemctl status riptide
docker exec <container> systemctl status aethir-checker

# Check logs
docker logs <container>
docker exec <container> journalctl -u riptide --no-pager
```

#### Issue: Wallet not created
```bash
# Check wallet files
docker exec <container> ls -la ~/.aethir*
docker exec <container> find /opt/aethir-checker -name "*.wallet"
```

### Debug Commands
```bash
# Container introspection
docker exec <container> ps aux
docker exec <container> systemctl list-units
docker exec <container> systemctl list-jobs

# Service debugging
docker exec <container> systemctl status riptide -l
docker exec <container> journalctl -u riptide -f
docker exec <container> journalctl -u aethir-checker -f
```

## 📞 Support

For deployment issues:
1. Check the troubleshooting section
2. Review container logs: `docker logs <container>`
3. Verify systemd integration
4. Test with manual commands provided

## 🔄 Updates & Maintenance

### Rolling Updates
```yaml
updateStrategy:
  type: "rolling"
  maxUnavailable: 0
  maxSurge: 1
  minReadySeconds: 30
```

### Backup Strategy
```yaml
backup:
  walletFiles: "/opt/aethir-checker/.aethir"
  frequency: "daily"
  retention: "30 days"
  encryption: true
```
