const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

module.exports = {
  installSecrets: async ({ logger }) => {
    logger.info('Installing secrets for Aethir Checker');
    // No secrets needed for Aethir, but we can prepare for future use
    return { success: true };
  },

  start: async ({ logger }) => {
    logger.info('Starting Aethir Checker service (Riptide only)');
    // Aethir installation and wallet creation is handled separately
    // Riptide only manages health checks and orchestrator communication
  },

  health: async ({ logger, utils }) => {
    logger.debug('Checking Aethir Checker health');
    
    try {
      // Run the health check command: aethir license summary
      const result = await utils.execCommand('/root/AethirCheckerCLI-linux/AethirCheckerCLI license summary', {
        timeout: 30000, // 30 seconds timeout
        cwd: '/root'
      });
      
      if (result.exitCode === 0) {
        logger.debug('Aethir health check passed');
        return true;
      } else {
        logger.warn('Aethir health check failed', {
          exitCode: result.exitCode,
          stderr: result.stderr
        });
        return false;
      }
    } catch (error) {
      logger.error('Health check error', { error: error.message });
      return false;
    }
  },

  stop: async ({ logger }) => {
    logger.info('Stopping Aethir Checker service');
    // Aethir doesn't need special cleanup, but we can log the stop event
    logger.info('Aethir Checker service stopped');
  },

  heartbeat: async ({ logger }) => {
    // Enhanced heartbeat with system metrics
    try {
      const walletExists = await utils.fileExists('/root/wallet.json');
      const systemInfo = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'aethir-checker',
        wallet_created: walletExists,
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        platform: os.platform(),
        arch: os.arch(),
        node_version: process.version
      };
      
      logger.debug('Heartbeat sent', systemInfo);
      return systemInfo;
    } catch (error) {
      logger.error('Heartbeat error', { error: error.message });
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  },

  status: async ({ logger }) => {
    // Enhanced status with detailed system information
    try {
      const walletExists = await utils.fileExists('/root/wallet.json');
      let walletInfo = null;
      
      if (walletExists) {
        try {
          const walletData = JSON.parse(await fs.readFile('/root/wallet.json', 'utf8'));
          walletInfo = {
            has_private_key: !!walletData.private_key,
            has_public_key: !!walletData.public_key,
            public_key: walletData.public_key ? walletData.public_key.substring(0, 8) + '...' : null
          };
        } catch (error) {
          logger.warn('Could not read wallet info', { error: error.message });
        }
      }

      // Check Aethir license status
      let aethirLicenseStatus = null;
      try {
        const result = await utils.execCommand('/root/AethirCheckerCLI-linux/AethirCheckerCLI license summary', {
          timeout: 30000,
          cwd: '/root'
        });
        
        if (result.exitCode === 0) {
          // Parse the license summary output
          const lines = result.stdout.split('\n');
          const licenseData = {};
          
          for (const line of lines) {
            if (line.includes('Checking')) {
              const match = line.match(/(\d+)\s+Checking/);
              if (match) licenseData.checking = parseInt(match[1]);
            } else if (line.includes('Ready')) {
              const match = line.match(/(\d+)\s+Ready/);
              if (match) licenseData.ready = parseInt(match[1]);
            } else if (line.includes('Offline')) {
              const match = line.match(/(\d+)\s+Offline/);
              if (match) licenseData.offline = parseInt(match[1]);
            } else if (line.includes('Banned')) {
              const match = line.match(/(\d+)\s+Banned/);
              if (match) licenseData.banned = parseInt(match[1]);
            } else if (line.includes('Pending')) {
              const match = line.match(/(\d+)\s+Pending/);
              if (match) licenseData.pending = parseInt(match[1]);
            } else if (line.includes('Total Delegated')) {
              const match = line.match(/(\d+)\s+Total Delegated/);
              if (match) licenseData.total_delegated = parseInt(match[1]);
            }
          }
          
          aethirLicenseStatus = {
            ...licenseData,
            cli_accessible: true,
            last_check: new Date().toISOString()
          };
          
          logger.info('Aethir license status retrieved', aethirLicenseStatus);
        } else {
          aethirLicenseStatus = {
            cli_accessible: false,
            error: result.stderr,
            last_check: new Date().toISOString()
          };
        }
      } catch (error) {
        logger.warn('Could not get Aethir license status', { error: error.message });
        aethirLicenseStatus = {
          cli_accessible: false,
          error: error.message,
          last_check: new Date().toISOString()
        };
      }

      // Check if Aethir service is running
      let aethirServiceStatus = 'unknown';
      try {
        const result = await utils.execCommand('systemctl is-active aethir-checker.service', {
          timeout: 5000
        });
        aethirServiceStatus = result.stdout.trim();
      } catch (error) {
        logger.warn('Could not check Aethir service status', { error: error.message });
      }

      return {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        wallet: {
          exists: walletExists,
          info: walletInfo
        },
        aethir: {
          service_status: aethirServiceStatus,
          license_status: aethirLicenseStatus
        },
        services: {
          aethir_checker: aethirServiceStatus,
          riptide: 'active'
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          node_version: process.version,
          memory_usage: process.memoryUsage(),
          load_average: os.loadavg()
        },
        service: 'aethir-checker'
      };
    } catch (error) {
      logger.error('Status check error', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message,
        service: 'aethir-checker',
        timestamp: new Date().toISOString()
      };
    }
  },

  // Core lifecycle and monitoring hooks (same category as heartbeat, status, health)

  ready: async ({ logger }) => {
    logger.info('Ready hook: Aethir Checker service is ready');
    
    try {
      // Check if all required components are ready
      const walletExists = await utils.fileExists('/root/wallet.json');
      const aethirCliExists = await utils.fileExists('/root/AethirCheckerCLI-linux/AethirCheckerCLI');
      
      if (!walletExists || !aethirCliExists) {
        logger.warn('Service not ready - missing components', {
          wallet_exists: walletExists,
          aethir_cli_exists: aethirCliExists
        });
        return { ready: false, reason: 'Missing required components' };
      }
      
      logger.info('Service is ready', {
        wallet_ready: walletExists,
        aethir_cli_ready: aethirCliExists,
        uptime: process.uptime()
      });
      
      return { ready: true };
    } catch (error) {
      logger.error('Ready hook error', { error: error.message });
      return { ready: false, error: error.message };
    }
  },

  probe: async ({ logger }) => {
    logger.debug('Probe hook: Liveness probe for Aethir Checker');
    
    try {
      // Quick liveness check - can the service respond?
      const walletExists = await utils.fileExists('/root/wallet.json');
      
      if (!walletExists) {
        logger.warn('Probe failed - no wallet found');
        return { alive: false, reason: 'No wallet' };
      }
      
      // Quick Aethir CLI check
      try {
        const result = await utils.execCommand('/root/AethirCheckerCLI-linux/AethirCheckerCLI --version', {
          timeout: 5000,
          cwd: '/root'
        });
        
        if (result.exitCode === 0) {
          logger.debug('Probe successful - service is alive');
          return { alive: true };
        } else {
          logger.warn('Probe failed - Aethir CLI not responding');
          return { alive: false, reason: 'CLI not responding' };
        }
      } catch (error) {
        logger.warn('Probe failed - CLI check error', { error: error.message });
        return { alive: false, reason: 'CLI check failed' };
      }
    } catch (error) {
      logger.error('Probe hook error', { error: error.message });
      return { alive: false, error: error.message };
    }
  },

  metrics: async ({ logger }) => {
    logger.debug('Metrics hook: Collecting Aethir Checker metrics');
    
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        service: 'aethir-checker',
        system: {
          uptime: process.uptime(),
          memory_usage: process.memoryUsage(),
          cpu_usage: process.cpuUsage(),
          load_average: os.loadavg(),
          platform: os.platform(),
          arch: os.arch(),
          node_version: process.version
        },
        wallet: {
          exists: await utils.fileExists('/root/wallet.json')
        }
      };

      // Add Aethir-specific metrics if possible
      try {
        const result = await utils.execCommand('/root/AethirCheckerCLI-linux/AethirCheckerCLI license summary', {
          timeout: 10000,
          cwd: '/root'
        });
        metrics.aethir = {
          cli_accessible: result.exitCode === 0,
          last_check: new Date().toISOString()
        };
      } catch (error) {
        metrics.aethir = {
          cli_accessible: false,
          error: error.message
        };
      }

      return metrics;
    } catch (error) {
      logger.error('Metrics collection error', { error: error.message });
      return {
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  },

  validate: async ({ logger }) => {
    logger.info('Validation hook: Checking Aethir Checker configuration');
    
    try {
      const checks = {
        wallet_exists: false,
        aethir_cli_exists: false,
        aethir_service_active: false,
        riptide_config_valid: false
      };

      // Check wallet
      checks.wallet_exists = await utils.fileExists('/root/wallet.json');
      
      // Check Aethir CLI
      checks.aethir_cli_exists = await utils.fileExists('/root/AethirCheckerCLI-linux/AethirCheckerCLI');
      
      // Check Aethir service
      try {
        const result = await utils.execCommand('systemctl is-active aethir-checker.service', {
          timeout: 5000
        });
        checks.aethir_service_active = result.stdout.trim() === 'active';
      } catch (error) {
        logger.warn('Could not check Aethir service status', { error: error.message });
      }

      // Check Riptide config
      try {
        const configData = await fs.readFile('/root/riptide.config.json', 'utf8');
        JSON.parse(configData);
        checks.riptide_config_valid = true;
      } catch (error) {
        logger.warn('Riptide config validation failed', { error: error.message });
      }

      const allPassed = Object.values(checks).every(check => check === true);
      
      logger.info('Validation complete', { checks, all_passed: allPassed });
      
      return {
        success: allPassed,
        checks,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Validation hook error', { error: error.message });
      return { success: false, error: error.message };
    }
  }
};