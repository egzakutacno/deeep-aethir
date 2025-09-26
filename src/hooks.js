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

  start: async ({ logger, utils }) => {
    logger.info('Aethir Checker is already running (started automatically)');
    
    // Verify the main service is running
    try {
      const result = await utils.execCommand('systemctl is-active aethir-checker.service', {
        timeout: 5000
      });
      
      if (result.stdout.trim() === 'active') {
        logger.info('Aethir Checker service is confirmed running');
        return { success: true };
      } else {
        logger.warn('Aethir Checker service is not active', { status: result.stdout.trim() });
        return { success: false, reason: 'Service not active' };
      }
    } catch (error) {
      logger.error('Error checking Aethir Checker service status', { error: error.message });
      return { success: false, error: error.message };
    }
  },

  health: async ({ logger, utils }) => {
    logger.debug('Checking Aethir Checker health via Typer');
    
    try {
      // Use Typer to get license status for health check
      const result = await utils.execCommand('/usr/bin/python3 /root/aethir_automation.py license-status', {
        timeout: 30000, // 30 seconds timeout
        cwd: '/root'
      });
      
      if (result.exitCode === 0) {
        // Parse the JSON output to check if we got valid data
        const licenseData = JSON.parse(result.stdout);
        logger.debug('Aethir health check passed via Typer', { status: licenseData.status });
        return true;
      } else {
        logger.warn('Aethir health check failed via Typer', {
          exitCode: result.exitCode,
          stderr: result.stderr
        });
        return false;
      }
    } catch (error) {
      logger.error('Health check error via Typer', { error: error.message });
      return false;
    }
  },

  stop: async ({ logger, utils }) => {
    logger.info('Stopping Aethir Checker services');
    
    try {
      // Stop the main Aethir service (the actual workload)
      await utils.execCommand('systemctl stop aethir-checker.service');
      logger.info('aethir-checker.service stopped');
      
      // Stop other Aethir-related services (but NOT Riptide)
      await utils.execCommand('systemctl stop aethir-installation.service');
      await utils.execCommand('systemctl stop aethir-wallet-watcher.service');
      logger.info('Other Aethir services stopped');
      
      // Kill any remaining Aethir processes (but NOT Riptide)
      await utils.execCommand('pkill -f AethirCheckerCLI || true');
      await utils.execCommand('pkill -f AethirCheckerService || true');
      logger.info('Any remaining Aethir processes killed');
      
      logger.info('Aethir Checker services stopped successfully');
      return { success: true };
      
    } catch (error) {
      logger.error('Error stopping Aethir Checker services', { error: error.message });
      throw error;
    }
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

  status: async ({ logger, utils }) => {
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

      // Check Aethir basic status using Typer (avoiding hanging CLI)
      let aethirLicenseStatus = null;
      try {
        const result = await utils.execCommand('/usr/bin/python3 /root/aethir_automation.py basic-status', {
          timeout: 10000, // Short timeout for basic status
          cwd: '/root'
        });
        
        if (result.exitCode === 0) {
          // Parse the JSON output from Typer
          const basicData = JSON.parse(result.stdout);
          aethirLicenseStatus = {
            ...basicData,
            cli_accessible: basicData.cli_exists,
            last_check: new Date().toISOString(),
            note: "Using basic status due to CLI hanging issue"
          };
          
          logger.info('Aethir basic status retrieved via Typer', aethirLicenseStatus);
        } else {
          logger.warn('Basic status command failed', { 
            exitCode: result.exitCode, 
            stderr: result.stderr,
            stdout: result.stdout 
          });
          aethirLicenseStatus = {
            cli_accessible: false,
            error: result.stderr || 'Unknown error',
            last_check: new Date().toISOString()
          };
        }
      } catch (error) {
        logger.error('Could not get Aethir basic status via Typer', { error: error.message });
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
      logger.error('Status check error', { error: error.message, stack: error.stack });
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