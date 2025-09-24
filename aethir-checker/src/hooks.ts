import type { HookContext } from '@deeep-network/riptide'
import { exec } from 'child_process'
import { spawn } from 'child_process'
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
  
  return new Promise((resolve, reject) => {
    let outputBuffer = ''
    let state: 'waiting_for_terms' | 'waiting_for_prompt' | 'waiting_for_keys' | 'done' = 'waiting_for_terms'
    
    // Spawn the Aethir CLI process
    const aethirProcess = spawn('./AethirCheckerCLI', {
      cwd: '/opt/aethir-checker',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    // Handle stdout line by line
    aethirProcess.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString()
      outputBuffer += chunk
      
      // Log all output for debugging
      logger.info(`[AETHIR SETUP] ${chunk.trim()}`)
      
      // Process line by line
      const lines = outputBuffer.split('\n')
      outputBuffer = lines.pop() || '' // Keep incomplete line in buffer
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        
        // State machine for handling prompts
        switch (state) {
          case 'waiting_for_terms':
            if (trimmedLine.includes('Press y to continue') || trimmedLine.includes('Y/N:')) {
              logger.info('Terms prompt detected, sending "y"')
              aethirProcess.stdin.write('y\n')
              state = 'waiting_for_prompt'
            }
            break
            
          case 'waiting_for_prompt':
            if (trimmedLine.includes('Aethir>')) {
              logger.info('Aethir prompt detected, sending wallet create command')
              aethirProcess.stdin.write('aethir wallet create\n')
              state = 'waiting_for_keys'
            }
            break
            
          case 'waiting_for_keys':
            // Look for wallet keys in the output
            const privateKeyMatch = trimmedLine.match(/Current private key:\s*(.+)/)
            const publicKeyMatch = trimmedLine.match(/Current public key:\s*(.+)/)
            
            if (privateKeyMatch) {
              walletKeys.privateKey = privateKeyMatch[1].trim()
              logger.info('Private key extracted')
            }
            
            if (publicKeyMatch) {
              walletKeys.publicKey = publicKeyMatch[1].trim()
              logger.info('Public key extracted')
            }
            
            // Check if we have both keys
            if (walletKeys.privateKey && walletKeys.publicKey) {
              logger.info('Wallet keys extracted successfully')
              state = 'done'
              aethirProcess.kill('SIGTERM')
            }
            break
        }
      }
    })
    
    // Handle stderr
    aethirProcess.stderr.on('data', (data: Buffer) => {
      logger.error(`[AETHIR ERROR] ${data.toString()}`)
    })
    
    // Handle process exit
    aethirProcess.on('close', (code: number) => {
      if (state === 'done' && walletKeys.privateKey && walletKeys.publicKey) {
        logger.info('Aethir setup completed successfully')
        resolve()
      } else {
        logger.error(`Aethir process exited with code ${code}`)
        reject(new Error(`Aethir setup failed with exit code ${code}`))
      }
    })
    
    // Handle process errors
    aethirProcess.on('error', (error: Error) => {
      logger.error(`Aethir process error: ${error.message}`)
      reject(error)
    })
    
    // Set timeout to prevent hanging
    setTimeout(() => {
      if (state !== 'done') {
        logger.error('Aethir setup timed out')
        aethirProcess.kill('SIGTERM')
        reject(new Error('Aethir setup timed out'))
      }
    }, 30000) // 30 second timeout
  })
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
