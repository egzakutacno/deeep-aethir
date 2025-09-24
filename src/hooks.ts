import type { HookContext } from '@deeep-network/riptide'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let walletKeys: { privateKey?: string; publicKey?: string } = {}

module.exports = {
  installSecrets: async ({ env, logger }: HookContext) => {
    logger.info('Checking Aethir checker configuration')
    
    // No specific secrets required for Aethir checker
    // Wallet will be created during startup
    return { success: true }
  },

  start: async ({ env, logger }: HookContext) => {
    logger.info('Starting Aethir checker setup via systemd')
    
    try {
      // Step 1: Accept terms and create wallet
      await setupAethirWallet(logger)
      
      // Step 2: Start Aethir service via systemd
      await startAethirService(logger)
      
      logger.info('Aethir checker started successfully via systemd')
    } catch (error) {
      logger.error(`Failed to start Aethir checker: ${error}`)
      throw error
    }
  },

  health: async ({ logger, utils }: HookContext) => {
    logger.debug('Checking Aethir checker health via systemd')
    
    try {
      const { stdout } = await execAsync('systemctl is-active aethir-checker')
      return stdout.trim() === 'active'
    } catch (error) {
      logger.error(`Health check failed: ${error}`)
      return false
    }
  },

  heartbeat: async ({ logger }: HookContext) => {
    logger.debug('Reporting Aethir checker status')
    
    return {
      status: 'running',
      walletKeys: walletKeys,
      serviceStatus: await getServiceStatus()
    }
  },

  stop: async ({ logger, utils }: HookContext) => {
    logger.info('Stopping Aethir checker via systemd')
    
    try {
      await execAsync('systemctl stop aethir-checker')
      logger.info('Aethir checker stopped via systemd')
    } catch (error) {
      logger.error(`Failed to stop Aethir checker: ${error}`)
    }
  }
}

async function setupAethirWallet(logger: any): Promise<void> {
  logger.info('Setting up Aethir wallet...')
  
  try {
    // Use a simple approach - just send the commands with proper timing
    logger.info('Creating input file with proper timing...')
    await execAsync('echo -e "y\\n\\n\\naethir wallet create" > /tmp/aethir_input.txt')
    
    logger.info('Running Aethir setup...')
    const { stdout } = await execAsync('bash -c "cd /opt/aethir-checker && timeout 20 ./AethirCheckerCLI < /tmp/aethir_input.txt"')
    
    // Extract wallet keys from output
    const privateKeyMatch = stdout.match(/Current private key:\s*([^\n]+)/)
    const publicKeyMatch = stdout.match(/Current public key:\s*([^\n]+)/)
    
    if (privateKeyMatch && publicKeyMatch) {
      walletKeys.privateKey = privateKeyMatch[1].trim()
      walletKeys.publicKey = publicKeyMatch[1].trim()
      logger.info('Wallet keys extracted successfully')
    } else {
      logger.error('Failed to extract wallet keys from output')
      logger.error(`Full output: ${stdout}`)
      throw new Error('Wallet key extraction failed')
    }
  } catch (error) {
    logger.error(`Aethir setup failed: ${error}`)
    throw error
  }
}

async function startAethirService(logger: any): Promise<void> {
  logger.info('Starting Aethir checker service via systemd...')
  
  try {
    await execAsync('systemctl start aethir-checker')
    logger.info('Aethir service started via systemd')
  } catch (error) {
    logger.error(`Failed to start Aethir service: ${error}`)
    throw error
  }
}

async function getServiceStatus(): Promise<string> {
  try {
    const { stdout } = await execAsync('systemctl is-active aethir-checker')
    return stdout.trim()
  } catch {
    return 'inactive'
  }
}
