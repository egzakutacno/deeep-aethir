import type { HookContext } from '@deeep-network/riptide'
import { spawn, ChildProcess } from 'child_process'
import { MissingSecretError } from '@deeep-network/riptide'

let aethirProcess: ChildProcess | null = null
let walletKeys: { privateKey?: string; publicKey?: string } = {}

module.exports = {
  installSecrets: async ({ env, logger }: HookContext) => {
    logger.info('Checking Aethir checker configuration')
    
    // No specific secrets required for Aethir checker
    // Wallet will be created during startup
    return { success: true }
  },

  start: async ({ env, logger }: HookContext) => {
    logger.info('Starting Aethir checker setup and service')
    
    try {
      // Step 1: Accept terms of service and create wallet
      await setupAethirWallet(logger)
      
      // Step 2: Start the Aethir checker service
      await startAethirService(logger)
      
      logger.info('Aethir checker started successfully')
    } catch (error) {
      logger.error(`Failed to start Aethir checker: ${error}`)
      throw error
    }
  },

  health: async ({ logger, utils }: HookContext) => {
    logger.debug('Checking Aethir checker health')
    
    if (!aethirProcess || !aethirProcess.pid) {
      return false
    }

    try {
      process.kill(aethirProcess.pid, 0)
      return true
    } catch {
      return false
    }
  },

  heartbeat: async ({ logger }: HookContext) => {
    logger.debug('Reporting Aethir checker status')
    
    return {
      status: 'running',
      walletKeys: walletKeys,
      processId: aethirProcess?.pid || null
    }
  },

  stop: async ({ logger, utils }: HookContext) => {
    logger.info('Stopping Aethir checker process')
    
    if (aethirProcess && aethirProcess.pid) {
      try {
        process.kill(aethirProcess.pid, 'SIGTERM')
        await utils.sleep(2000)
        
        try {
          process.kill(aethirProcess.pid, 0)
          process.kill(aethirProcess.pid, 'SIGKILL')
          logger.warn('Had to force kill Aethir process')
        } catch {
          logger.info('Aethir process stopped gracefully')
        }
      } catch (error) {
        logger.debug('Aethir process already stopped')
      }
    }
    
    aethirProcess = null
  }
}

async function setupAethirWallet(logger: any): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('Setting up Aethir wallet...')
    
    const setupProcess = spawn('bash', ['-c', `
      cd /opt/aethir-checker && 
      echo "y" | ./AethirCheckerCLI
    `], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    
    setupProcess.stdout?.on('data', (data) => {
      output += data.toString()
      logger.info(`[AETHIR SETUP] ${data.toString().trim()}`)
    })

    setupProcess.stderr?.on('data', (data) => {
      logger.error(`[AETHIR SETUP ERROR] ${data.toString().trim()}`)
    })

    setupProcess.on('close', (code) => {
      if (code === 0) {
        // Extract wallet keys from output
        const privateKeyMatch = output.match(/Current private key:\s*([^\n]+)/)
        const publicKeyMatch = output.match(/Current public key:\s*([^\n]+)/)
        
        if (privateKeyMatch && publicKeyMatch) {
          walletKeys.privateKey = privateKeyMatch[1].trim()
          walletKeys.publicKey = publicKeyMatch[1].trim()
          logger.info('Wallet keys extracted successfully')
          resolve()
        } else {
          logger.error('Failed to extract wallet keys from output')
          reject(new Error('Wallet key extraction failed'))
        }
      } else {
        logger.error(`Aethir setup failed with code ${code}`)
        reject(new Error(`Setup process exited with code ${code}`))
      }
    })

    setupProcess.on('error', (error) => {
      logger.error(`Failed to start Aethir setup: ${error.message}`)
      reject(error)
    })
  })
}

async function startAethirService(logger: any): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('Starting Aethir checker service...')
    
    aethirProcess = spawn('/opt/aethir-checker/AethirCheckerCLI', [], {
      cwd: '/opt/aethir-checker',
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    aethirProcess.on('spawn', () => {
      logger.info(`Aethir service started with PID: ${aethirProcess?.pid}`)
      resolve()
    })

    aethirProcess.on('error', (error) => {
      logger.error(`Failed to start Aethir service: ${error.message}`)
      reject(error)
    })

    aethirProcess.stdout?.on('data', (data) => {
      logger.info(`[AETHIR] ${data.toString().trim()}`)
    })

    aethirProcess.stderr?.on('data', (data) => {
      logger.error(`[AETHIR ERROR] ${data.toString().trim()}`)
    })

    aethirProcess.unref()
  })
}
