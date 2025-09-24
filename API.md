# Aethir Checker API Specification

This document defines the API interfaces and data formats for the Aethir Checker service integrated with Riptide SDK.

## 🎯 Overview

The Aethir Checker service exposes several interfaces for orchestration:
- **Health Endpoint**: Service health status
- **Heartbeat Endpoint**: Comprehensive service data
- **Status Endpoint**: Real-time service information
- **Metrics Endpoint**: Prometheus-compatible metrics

## 🔌 Endpoints

### Health Check
**Endpoint**: `/health`  
**Method**: `GET`  
**Purpose**: Quick health verification

#### Request
```http
GET /health HTTP/1.1
Host: localhost:3000
```

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2025-09-24T06:42:32.091Z",
  "service": "aethir-checker"
}
```

#### Status Codes
- `200 OK`: Service is healthy
- `503 Service Unavailable`: Service is unhealthy

---

### Heartbeat
**Endpoint**: `/heartbeat`  
**Method**: `GET`  
**Purpose**: Comprehensive service data for orchestrator

#### Request
```http
GET /heartbeat HTTP/1.1
Host: localhost:3000
```

#### Response
```json
{
  "status": "running",
  "timestamp": "2025-09-24T06:42:32.091Z",
  "service": "aethir-checker",
  "walletKeys": {
    "privateKey": "LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlCT2dJQkFBSkJBT1BoTmYvOUd2c1VDOGl0dUtrSUZjaHd4K1ZZLzl3MEJ2eG5oUVRnV29wUVRsOGZVV2FkCkhaK1BlVEExK0dFYWFLZm90ckE3VWlaZi9lZXJoWFQvelNzQ0F3RUFBUUpBRWhJUTR5emlEOWtHR2pMVWV1cisKTnpmaVVpaWRtWXV5cGg5YmFBaVdoWE0waFVHNU9WREJpSEswRG8rZ0NNc05qbGtNOGFDRzFyM3Y3dFBMbXgwVAplUUloQVBIVHBPdi9GeU9haWFCV2llalNmTHpxWnRCRURVbDdQZCtmRXAyOFFxdC9BaUVBOFR4T2U0VVVjUkdyCnVpWVd1aEpoUXd0MGNCNHQ2WktjL0pvVjJyakJKRlVDSUVGTTltN252amJXQnkzdDBHVzNXUW1tZmtiazZYV2IKT3ZVRXZvRXJraEUvQWlBdTVCMFJUMzM0dUltYjVubDJjOG9xSVJqaURrdTRZa0pYcTQvaDh4Vy8vUUloQUpzMQpvbnFQcW1vZkxHU0k5OEkwWVgvOTJFYlBNUkpMcTB4QkNVb0NrVXhPCi0tLS0tRU5EIFJTQSBQUklWQVRFIEtFWS0tLS0tCg==",
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
  "serviceStatus": "active",
  "uptime": "2h 15m 30s",
  "version": "1.0.0"
}
```

#### Field Descriptions

**`status`** (string)
- `"running"`: Service is operational
- `"error"`: Service encountered an error
- `"stopped"`: Service is not running

**`walletKeys`** (object)
- `privateKey` (string): Base64-encoded RSA private key
- `publicKey` (string): Hex-encoded public key (40 characters)

**`licenseSummary`** (object)
- `checking` (integer): Licenses currently being checked
- `ready` (integer): Licenses ready for use
- `offline` (integer): Licenses that are offline
- `banned` (integer): Licenses that are banned
- `pending` (integer): Licenses pending approval
- `totalDelegated` (integer): Total licenses delegated to wallet

**`serviceStatus`** (string)
- `"active"`: Aethir service is running
- `"inactive"`: Aethir service is stopped
- `"failed"`: Aethir service failed to start

---

### Status
**Endpoint**: `/status`  
**Method**: `GET`  
**Purpose**: Detailed service status information

#### Request
```http
GET /status HTTP/1.1
Host: localhost:3000
```

#### Response
```json
{
  "service": {
    "name": "aethir-checker",
    "version": "1.0.0",
    "status": "running",
    "uptime": "2h 15m 30s",
    "startTime": "2025-09-24T04:27:02.000Z"
  },
  "systemd": {
    "riptide": "active",
    "aethir-checker": "active"
  },
  "wallet": {
    "exists": true,
    "created": "2025-09-24T04:27:15.000Z",
    "publicKey": "fb65da1e0cff06dc86cad9ebfbf6260a43f25442"
  },
  "licenses": {
    "total": 0,
    "ready": 0,
    "pending": 0,
    "lastChecked": "2025-09-24T06:42:32.000Z"
  }
}
```

---

### Metrics
**Endpoint**: `/metrics`  
**Method**: `GET`  
**Purpose**: Prometheus-compatible metrics

#### Request
```http
GET /metrics HTTP/1.1
Host: localhost:3000
Accept: text/plain
```

#### Response
```
# HELP aethir_checker_up Service is running
# TYPE aethir_checker_up gauge
aethir_checker_up 1

# HELP aethir_checker_uptime_seconds Service uptime in seconds
# TYPE aethir_checker_uptime_seconds counter
aethir_checker_uptime_seconds 8130

# HELP aethir_checker_licenses_total Total number of licenses
# TYPE aethir_checker_licenses_total gauge
aethir_checker_licenses_total{status="ready"} 0
aethir_checker_licenses_total{status="pending"} 0
aethir_checker_licenses_total{status="checking"} 0
aethir_checker_licenses_total{status="offline"} 0
aethir_checker_licenses_total{status="banned"} 0

# HELP aethir_checker_heartbeat_duration_seconds Time taken to process heartbeat
# TYPE aethir_checker_heartbeat_duration_seconds histogram
aethir_checker_heartbeat_duration_seconds_bucket{le="0.1"} 45
aethir_checker_heartbeat_duration_seconds_bucket{le="0.5"} 48
aethir_checker_heartbeat_duration_seconds_bucket{le="1.0"} 50
aethir_checker_heartbeat_duration_seconds_bucket{le="+Inf"} 50
aethir_checker_heartbeat_duration_seconds_sum 12.5
aethir_checker_heartbeat_duration_seconds_count 50
```

## 🔄 Webhook Integration

### Lifecycle Events
The service can send webhooks for important events:

#### Wallet Created
```json
{
  "event": "wallet.created",
  "timestamp": "2025-09-24T04:27:15.000Z",
  "service": "aethir-checker",
  "data": {
    "publicKey": "fb65da1e0cff06dc86cad9ebfbf6260a43f25442",
    "privateKeyLength": 1675
  }
}
```

#### License Approved
```json
{
  "event": "license.approved",
  "timestamp": "2025-09-24T06:42:32.000Z",
  "service": "aethir-checker",
  "data": {
    "licensesApproved": 3,
    "totalLicenses": 5
  }
}
```

#### Service Error
```json
{
  "event": "service.error",
  "timestamp": "2025-09-24T06:42:32.000Z",
  "service": "aethir-checker",
  "data": {
    "error": "Failed to start Aethir service",
    "code": "SERVICE_START_FAILED",
    "retryable": true
  }
}
```

## 📊 Data Models

### Wallet Keys
```typescript
interface WalletKeys {
  privateKey: string;  // Base64-encoded RSA private key
  publicKey: string;   // Hex-encoded public key (40 chars)
}
```

### License Summary
```typescript
interface LicenseSummary {
  checking: number;        // Licenses being checked
  ready: number;          // Licenses ready for use
  offline: number;        // Licenses that are offline
  banned: number;         // Licenses that are banned
  pending: number;        // Licenses pending approval
  totalDelegated: number; // Total licenses delegated
}
```

### Service Status
```typescript
interface ServiceStatus {
  status: "running" | "error" | "stopped";
  serviceStatus: "active" | "inactive" | "failed";
  uptime: string;
  version: string;
  timestamp: string;
}
```

## 🔒 Security Considerations

### API Authentication
- Currently no authentication required (internal service)
- Consider adding API keys for production deployments
- Use HTTPS in production environments

### Data Protection
- **Private Keys**: Sensitive data, handle with care
- **Public Keys**: Safe to log and store
- **License Data**: Business-sensitive, monitor access

### Network Security
- Service runs on internal network only
- No external ports exposed by default
- Use reverse proxy for external access if needed

## 🧪 Testing

### Health Check Test
```bash
curl -f http://localhost:3000/health || echo "Health check failed"
```

### Heartbeat Test
```bash
curl -s http://localhost:3000/heartbeat | jq '.status'
```

### Metrics Test
```bash
curl -s http://localhost:3000/metrics | grep aethir_checker_up
```

### Load Testing
```bash
# Test heartbeat endpoint under load
for i in {1..100}; do
  curl -s http://localhost:3000/heartbeat > /dev/null &
done
wait
```

## 📝 Integration Examples

### Prometheus Scraping
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'aethir-checker'
    static_configs:
      - targets: ['aethir-checker:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Aethir Checker Monitoring",
    "panels": [
      {
        "title": "Service Status",
        "type": "stat",
        "targets": [
          {
            "expr": "aethir_checker_up",
            "legendFormat": "Service Up"
          }
        ]
      },
      {
        "title": "License Distribution",
        "type": "piechart",
        "targets": [
          {
            "expr": "aethir_checker_licenses_total",
            "legendFormat": "{{status}}"
          }
        ]
      }
    ]
  }
}
```

### Orchestrator Integration
```python
import requests
import json

class AethirCheckerClient:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
    
    def get_health(self):
        response = requests.get(f"{self.base_url}/health")
        return response.json()
    
    def get_heartbeat(self):
        response = requests.get(f"{self.base_url}/heartbeat")
        return response.json()
    
    def get_wallet_keys(self):
        heartbeat = self.get_heartbeat()
        return heartbeat.get("walletKeys", {})
    
    def get_license_summary(self):
        heartbeat = self.get_heartbeat()
        return heartbeat.get("licenseSummary", {})

# Usage
client = AethirCheckerClient()
health = client.get_health()
wallet_keys = client.get_wallet_keys()
licenses = client.get_license_summary()
```
