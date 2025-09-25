const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

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
    // Optional: Send heartbeat data to orchestrator
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'aethir-checker'
    };
  },

  status: async ({ logger }) => {
    // Return detailed status information
    try {
      const walletExists = await utils.fileExists('/root/wallet.json');
      return {
        status: 'healthy',
        uptime: process.uptime(),
        wallet_created: walletExists,
        service: 'aethir-checker'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        service: 'aethir-checker'
      };
    }
  }
};
