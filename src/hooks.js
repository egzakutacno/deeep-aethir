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

  // Additional hooks for enhanced functionality

  preStart: async ({ logger }) => {
    logger.info('Pre-start hook: Preparing Aethir Checker environment');
    
    try {
      // Ensure wallet exists before starting
      const walletExists = await utils.fileExists('/root/wallet.json');
      if (!walletExists) {
        logger.warn('No wallet found, this might indicate an issue with wallet creation');
        return { success: false, reason: 'No wallet found' };
      }
      
      logger.info('Pre-start validation passed');
      return { success: true };
    } catch (error) {
      logger.error('Pre-start hook error', { error: error.message });
      return { success: false, error: error.message };
    }
  },

  postStart: async ({ logger }) => {
    logger.info('Post-start hook: Aethir Checker service started successfully');
    
    try {
      // Log startup metrics
      const walletExists = await utils.fileExists('/root/wallet.json');
      logger.info('Service startup complete', {
        wallet_ready: walletExists,
        uptime: process.uptime(),
        memory_usage: process.memoryUsage()
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Post-start hook error', { error: error.message });
      return { success: false, error: error.message };
    }
  },

  preStop: async ({ logger }) => {
    logger.info('Pre-stop hook: Preparing to stop Aethir Checker service');
    
    try {
      // Log shutdown metrics
      logger.info('Service shutdown initiated', {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage()
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Pre-stop hook error', { error: error.message });
      return { success: false, error: error.message };
    }
  },

  postStop: async ({ logger }) => {
    logger.info('Post-stop hook: Aethir Checker service stopped');
    
    try {
      // Cleanup or final logging
      logger.info('Service shutdown complete', {
        final_uptime: process.uptime()
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Post-stop hook error', { error: error.message });
      return { success: false, error: error.message };
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

  alerts: async ({ logger }) => {
    logger.debug('Alerts hook: Checking for Aethir Checker alerts');
    
    try {
      const alerts = [];
      
      // Check wallet status
      const walletExists = await utils.fileExists('/root/wallet.json');
      if (!walletExists) {
        alerts.push({
          level: 'critical',
          message: 'Wallet not found',
          timestamp: new Date().toISOString()
        });
      }

      // Check Aethir service status
      try {
        const result = await utils.execCommand('systemctl is-active aethir-checker.service', {
          timeout: 5000
        });
        if (result.stdout.trim() !== 'active') {
          alerts.push({
            level: 'warning',
            message: 'Aethir service not active',
            status: result.stdout.trim(),
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        alerts.push({
          level: 'error',
          message: 'Could not check Aethir service status',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsageMB = memUsage.heapUsed / 1024 / 1024;
      if (memUsageMB > 500) { // Alert if using more than 500MB
        alerts.push({
          level: 'warning',
          message: 'High memory usage',
          memory_mb: Math.round(memUsageMB),
          timestamp: new Date().toISOString()
        });
      }

      if (alerts.length > 0) {
        logger.warn('Alerts detected', { alert_count: alerts.length, alerts });
      }

      return {
        alerts,
        alert_count: alerts.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Alerts hook error', { error: error.message });
      return {
        alerts: [{
          level: 'error',
          message: 'Alerts check failed',
          error: error.message,
          timestamp: new Date().toISOString()
        }],
        alert_count: 1,
        timestamp: new Date().toISOString()
      };
    }
  }
};