# Aethir Checker Architecture Documentation

This document provides a comprehensive overview of the system architecture, design decisions, and technical implementation details.

## 🏗️ System Architecture

### High-Level Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestration Layer                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              NerdNode Orchestrator                          ││
│  │  • Container Management                                    ││
│  │  • Health Monitoring                                       ││
│  │  • Data Collection                                         ││
│  │  • Scaling & Deployment                                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP/API Calls
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Container Layer                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Docker Container                               ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │              systemd (PID 1)                           │││
│  │  │  • Process Management                                   │││
│  │  │  • Service Orchestration                                │││
│  │  │  • Resource Management                                  │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │              Riptide Service                            │││
│  │  │  • Lifecycle Management                                 │││
│  │  │  • Health Monitoring                                    │││
│  │  │  • Data Reporting                                       │││
│  │  │  • Interactive Automation                               │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │                                                             ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │              Aethir Checker Service                     │││
│  │  │  • Blockchain Validation                                │││
│  │  │  • License Management                                   │││
│  │  │  • Wallet Operations                                    │││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Blockchain Network
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Aethir Network                              │
│  • Blockchain Nodes                                            │
│  • License Distribution                                        │
│  • Validation Protocol                                         │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Component Details

### 1. Container Infrastructure

#### Base Image: `eniocarboni/docker-ubuntu-systemd:jammy`
- **Purpose**: Provides systemd as PID 1
- **Requirements**: Privileged mode, cgroup access
- **Benefits**: 
  - Native service management
  - Process supervision
  - Resource control
  - Logging integration

#### Container Configuration
```dockerfile
FROM eniocarboni/docker-ubuntu-systemd:jammy
# Required flags:
# --privileged --cgroupns=host -v /sys/fs/cgroup:/sys/fs/cgroup
```

### 2. systemd (PID 1)

#### Role
- **Primary Process**: PID 1 in container
- **Service Manager**: Manages all other services
- **Process Supervision**: Automatic restart on failure
- **Resource Management**: Memory and CPU limits

#### Services Managed
```bash
# Riptide service
/etc/systemd/system/riptide.service

# Aethir checker service  
/etc/systemd/system/aethir-checker.service
```

#### Service Dependencies
```ini
[Unit]
Description=Riptide Service
After=network.target
Requires=aethir-checker.service

[Service]
Type=simple
User=root
WorkingDirectory=/riptide
ExecStart=/usr/bin/riptide start --config /riptide/riptide.config.json --hooks /riptide/hooks.js
Restart=always
RestartSec=10
```

### 3. Riptide SDK Integration

#### Lifecycle Hooks
```typescript
interface RiptideHooks {
  installSecrets(context: HookContext): Promise<void>;
  start(context: HookContext): Promise<void>;
  health(context: HookContext): Promise<boolean>;
  heartbeat(context: HookContext): Promise<ServiceData>;
  stop(context: HookContext): Promise<void>;
}
```

#### Hook Implementation
- **installSecrets**: Validate configuration
- **start**: Setup wallet, start Aethir service
- **health**: Check service status via systemctl
- **heartbeat**: Collect and report service data
- **stop**: Gracefully shutdown Aethir service

### 4. Aethir Checker Service

#### Installation Process
1. Extract Aethir binary from tar.gz
2. Run `install.sh` to create systemd service
3. Service becomes available via systemctl

#### Service Management
```bash
# Start service
systemctl start aethir-checker

# Check status
systemctl status aethir-checker

# Stop service
systemctl stop aethir-checker

# View logs
journalctl -u aethir-checker -f
```

## 🔄 Data Flow

### 1. Startup Sequence
```
Container Start
      │
      ▼
systemd (PID 1)
      │
      ▼
Riptide Service Start
      │
      ▼
installSecrets Hook
      │
      ▼
start Hook
      │
      ├─► Wallet Setup (Interactive)
      │   ├─► Accept Terms
      │   ├─► Create Wallet
      │   └─► Extract Keys
      │
      ▼
Aethir Service Start
      │
      ▼
Service Ready
```

### 2. Runtime Operations
```
Heartbeat Request (every 30s)
      │
      ▼
heartbeat Hook
      │
      ├─► Get Wallet Keys (aethir wallet export)
      ├─► Get License Summary (aethir license summary)
      ├─► Auto-approve Licenses (aethir license approve --all)
      └─► Check Service Status (systemctl is-active)
      │
      ▼
Return Service Data
      │
      ▼
Orchestrator Processing
```

### 3. Shutdown Sequence
```
Stop Request
      │
      ▼
stop Hook
      │
      ▼
systemctl stop aethir-checker
      │
      ▼
systemctl stop riptide
      │
      ▼
Container Exit
```

## 🛠️ Technical Implementation

### Interactive Automation

#### Challenge
Aethir CLI requires interactive input:
- Terms of service acceptance
- Wallet creation commands
- License management

#### Solution: State Machine
```typescript
type SetupState = 
  | 'waiting_for_terms'
  | 'waiting_for_prompt' 
  | 'waiting_for_keys'
  | 'waiting_for_exit'
  | 'done';

const stateMachine = {
  'waiting_for_terms': {
    trigger: /Press y to continue/,
    action: () => aethirProcess.stdin.write('y\n'),
    next: 'waiting_for_prompt'
  },
  'waiting_for_prompt': {
    trigger: /Please create a wallet/,
    action: () => aethirProcess.stdin.write('aethir wallet create\n'),
    next: 'waiting_for_keys'
  }
  // ... more states
};
```

#### Buffer Management
```typescript
// Use spawn instead of exec for large outputs
const aethirProcess = spawn('./AethirCheckerCLI', {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Stream output and kill when target found
aethirProcess.stdout.on('data', (data: Buffer) => {
  outputBuffer += data.toString();
  if (targetFound && !keysFound) {
    keysFound = true;
    aethirProcess.kill('SIGTERM');
  }
});
```

### Key Extraction

#### Private Key Format
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
[Base64 encoded content]
...
-----END RSA PRIVATE KEY-----
```

#### Public Key Format
```
Current public key: fb65da1e0cff06dc86cad9ebfbf6260a43f25442
```

#### Extraction Logic
```typescript
// Multi-line private key extraction
const privateKeyMatch = outputBuffer.match(/Current private key:\s*(.*)/);
if (privateKeyMatch) {
  if (privateKeyMatch[1].trim()) {
    walletKeys.privateKey = privateKeyMatch[1].trim();
  } else {
    walletKeys.privateKey = '';
  }
}

// Continue collecting base64 lines
if (walletKeys.privateKey !== undefined && 
    !walletKeys.publicKey && 
    trimmedLine.match(/^[A-Za-z0-9+/=\s-]+$/)) {
  walletKeys.privateKey += trimmedLine;
}

// Public key extraction
const publicKeyMatch = outputBuffer.match(/Current public key:\s*([^\n]+)/);
if (publicKeyMatch) {
  walletKeys.publicKey = publicKeyMatch[1].trim();
}
```

### License Management

#### License Summary Format
```
Number  Status
------- --------
5       Ready
2       Checking
1       Offline
0       Banned
3       Pending
11      Total Delegated
```

#### Parsing Logic
```typescript
const checkingMatch = outputBuffer.match(/(\d+)\s+Checking/);
const readyMatch = outputBuffer.match(/(\d+)\s+Ready/);
const offlineMatch = outputBuffer.match(/(\d+)\s+Offline/);
const bannedMatch = outputBuffer.match(/(\d+)\s+Banned/);
const pendingMatch = outputBuffer.match(/(\d+)\s+Pending/);
const totalMatch = outputBuffer.match(/(\d+)\s+Total Delegated/);
```

#### Auto-approval
```typescript
if (licenseSummary.pending > 0) {
  logger.info(`Found ${licenseSummary.pending} pending licenses, auto-approving`);
  await approveAllLicenses(logger);
}
```

## 🔒 Security Architecture

### Container Security
- **Privileged Mode**: Required for systemd
- **CGroup Access**: Required for resource management
- **Network Isolation**: Internal network only
- **File System**: Read-only root filesystem (where possible)

### Key Management
- **Private Keys**: Encrypted at rest, transmitted securely
- **Public Keys**: Safe for logging and storage
- **Wallet Files**: Stored in container filesystem
- **Backup Strategy**: Orchestrator handles key backup

### Service Security
- **Process Isolation**: Each service runs in separate process
- **User Permissions**: Services run as appropriate users
- **Logging**: Comprehensive audit trail
- **Error Handling**: Secure error reporting

## 📊 Monitoring & Observability

### Health Monitoring
```typescript
health: async ({ logger, utils }: HookContext) => {
  try {
    const { stdout } = await execAsync('systemctl is-active aethir-checker');
    return stdout.trim() === 'active';
  } catch (error) {
    logger.error(`Health check failed: ${error}`);
    return false;
  }
}
```

### Metrics Collection
- **Service Uptime**: Tracked via systemd
- **License Status**: Real-time license counts
- **Wallet Status**: Key availability and validity
- **Error Rates**: Failed operations and retries

### Logging Strategy
```typescript
// Structured logging
logger.info('Setting up Aethir wallet...', {
  service: 'aethir-checker',
  operation: 'wallet_setup',
  timestamp: new Date().toISOString()
});

// Error logging with context
logger.error(`Failed to start Aethir service: ${error}`, {
  service: 'aethir-checker',
  operation: 'service_start',
  error: error.message,
  stack: error.stack
});
```

## 🚀 Performance Considerations

### Resource Usage
- **Memory**: ~2GB for Aethir service
- **CPU**: Variable based on blockchain activity
- **Storage**: ~1GB for blockchain data
- **Network**: Moderate bandwidth for blockchain sync

### Optimization Strategies
- **Early Process Termination**: Kill CLI when target data found
- **Streaming Output**: Avoid buffer overflow
- **Caching**: Cache license summaries
- **Connection Pooling**: Reuse CLI connections where possible

### Scalability
- **Single Instance**: One checker per container
- **Horizontal Scaling**: Multiple containers for load distribution
- **Resource Limits**: Set appropriate CPU/memory limits
- **Monitoring**: Track resource usage and performance

## 🔄 Error Handling & Recovery

### Error Categories
1. **Setup Errors**: Wallet creation failures
2. **Service Errors**: Aethir service crashes
3. **Network Errors**: Blockchain connectivity issues
4. **Resource Errors**: Memory/CPU exhaustion

### Recovery Strategies
```typescript
// Automatic retry with backoff
const retryWithBackoff = async (fn: Function, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
};

// Graceful degradation
heartbeat: async ({ logger }: HookContext) => {
  try {
    const walletKeys = await getCurrentWalletKeys(logger);
    const licenseSummary = await getLicenseSummary(logger);
    return { status: 'running', walletKeys, licenseSummary };
  } catch (error) {
    logger.error(`Heartbeat failed: ${error}`);
    return { 
      status: 'error', 
      error: error.message,
      serviceStatus: await getServiceStatus() 
    };
  }
}
```

## 📈 Future Enhancements

### Planned Improvements
1. **Metrics Dashboard**: Real-time monitoring UI
2. **Alerting System**: Proactive issue detection
3. **Backup Integration**: Automated wallet backup
4. **Multi-network Support**: Support for testnets
5. **Performance Optimization**: Faster startup times

### Extension Points
- **Custom Hooks**: Additional lifecycle events
- **Plugin System**: Modular functionality
- **API Extensions**: Additional endpoints
- **Integration Hooks**: Third-party service integration
