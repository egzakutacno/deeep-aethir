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
    logger.debug('Reporting Aethir checker status and managing licenses')
    
    try {
      // Get current wallet keys
      const currentKeys = await getCurrentWalletKeys(logger)
      
      // Get license summary
      const licenseSummary = await getLicenseSummary(logger)
      
      // Auto-approve pending licenses if any
      if (licenseSummary.pending > 0) {
        logger.info(`Found ${licenseSummary.pending} pending licenses, auto-approving`)
        await approveAllLicenses(logger)
        
        // Re-check summary after approval
        const updatedSummary = await getLicenseSummary(logger)
        logger.info(`License approval completed. New status: ${updatedSummary.ready} ready, ${updatedSummary.pending} pending`)
      }
      
      return {
        status: 'running',
        walletKeys: currentKeys,
        licenseSummary: licenseSummary,
        serviceStatus: await getServiceStatus()
      }
    } catch (error) {
      logger.error(`Heartbeat failed: ${error}`)
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        serviceStatus: await getServiceStatus()
      }
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
    let state: 'waiting_for_terms' | 'waiting_for_prompt' | 'waiting_for_keys' | 'waiting_for_exit' | 'done' = 'waiting_for_terms'
    
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
            logger.info(`Waiting for prompt, current line: "${trimmedLine}"`)
            if (trimmedLine.includes('Please create a wallet')) {
              logger.info('Wallet creation prompt detected, sending wallet create command')
              aethirProcess.stdin.write('aethir wallet create\n')
              state = 'waiting_for_keys'
            }
            break
            
          case 'waiting_for_keys':
            // Look for wallet keys in the output
            const privateKeyMatch = trimmedLine.match(/Current private key:\s*(.*)/)
            const publicKeyMatch = trimmedLine.match(/Current public key:\s*(.+)/)
            
            if (privateKeyMatch) {
              // Start collecting private key (multi-line base64)
              if (privateKeyMatch[1].trim()) {
                walletKeys.privateKey = privateKeyMatch[1].trim()
              } else {
                walletKeys.privateKey = ''
              }
              logger.info('Private key start detected')
            } else if (walletKeys.privateKey !== undefined && !walletKeys.publicKey && trimmedLine.match(/^[A-Za-z0-9+/=\s-]+$/)) {
              // Continue collecting private key lines (base64 content)
              walletKeys.privateKey += trimmedLine
            }
            
            if (publicKeyMatch) {
              walletKeys.publicKey = publicKeyMatch[1].trim()
              logger.info('Public key extracted')
            } else if (walletKeys.privateKey && !walletKeys.publicKey && trimmedLine.match(/^[a-f0-9]{40}$/)) {
              // Public key appears on the line after "Current public key:" (40 hex chars)
              walletKeys.publicKey = trimmedLine.trim()
              logger.info('Public key extracted from next line')
            }
            
            // Check for completion signal - "No licenses delegated" means setup is complete
            if (trimmedLine.includes('No licenses delegated to your burner wallet')) {
              logger.info('Aethir setup completed - wallet ready')
              if (!walletKeys.publicKey && walletKeys.privateKey) {
                // Extract public key from the previous line if not captured yet
                const lines = outputBuffer.split('\n')
                for (let i = lines.length - 1; i >= 0; i--) {
                  const pubKeyMatch = lines[i].trim().match(/Current public key:\s*(.+)/)
                  if (pubKeyMatch) {
                    walletKeys.publicKey = pubKeyMatch[1].trim()
                    logger.info('Public key extracted from previous line')
                    break
                  }
                }
              }
              logger.info(`Wallet keys - Private: ${walletKeys.privateKey ? 'found' : 'missing'}, Public: ${walletKeys.publicKey ? 'found' : 'missing'}`)
              
              // Send exit command to properly close the CLI and save wallet files
              logger.info('Sending exit command to save wallet files')
              aethirProcess.stdin.write('aethir exit\n')
              state = 'waiting_for_exit'
            }
            
            // Wait for the CLI to exit cleanly
            if (state === 'waiting_for_exit' && trimmedLine.includes('Wait a moment, the client is exiting')) {
              logger.info('Aethir CLI exiting cleanly, wallet files saved')
              state = 'done'
              // Let the process exit naturally instead of killing it
            }
            
            // Check if we have both keys (fallback)
            if (walletKeys.privateKey && walletKeys.publicKey) {
              logger.info('Wallet keys extracted successfully')
              logger.info(`Private key length: ${walletKeys.privateKey.length}`)
              logger.info(`Public key: ${walletKeys.publicKey}`)
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

async function getCurrentWalletKeys(logger: any): Promise<{ privateKey?: string; publicKey?: string }> {
  try {
    const { stdout } = await execAsync('bash -c "cd /opt/aethir-checker && echo \\"aethir wallet export\\" | timeout 10 ./AethirCheckerCLI"')
    
    // Extract keys from export output
    const privateKeyMatch = stdout.match(/Current private key:\s*([^\n]+)/)
    const publicKeyMatch = stdout.match(/Current public key:\s*([^\n]+)/)
    
    if (privateKeyMatch && publicKeyMatch) {
      return {
        privateKey: privateKeyMatch[1].trim(),
        publicKey: publicKeyMatch[1].trim()
      }
    }
    
    logger.warn('Could not extract wallet keys from export')
    return {}
  } catch (error) {
    logger.error(`Failed to get wallet keys: ${error}`)
    return {}
  }
}

async function getLicenseSummary(logger: any): Promise<{
  checking: number;
  ready: number;
  offline: number;
  banned: number;
  pending: number;
  totalDelegated: number;
}> {
  try {
    const { stdout } = await execAsync('bash -c "cd /opt/aethir-checker && echo \\"aethir license summary\\" | timeout 10 ./AethirCheckerCLI"')
    
    // Parse license summary output
    const checkingMatch = stdout.match(/(\d+)\s+Checking/)
    const readyMatch = stdout.match(/(\d+)\s+Ready/)
    const offlineMatch = stdout.match(/(\d+)\s+Offline/)
    const bannedMatch = stdout.match(/(\d+)\s+Banned/)
    const pendingMatch = stdout.match(/(\d+)\s+Pending/)
    const totalMatch = stdout.match(/(\d+)\s+Total Delegated/)
    
    return {
      checking: checkingMatch ? parseInt(checkingMatch[1]) : 0,
      ready: readyMatch ? parseInt(readyMatch[1]) : 0,
      offline: offlineMatch ? parseInt(offlineMatch[1]) : 0,
      banned: bannedMatch ? parseInt(bannedMatch[1]) : 0,
      pending: pendingMatch ? parseInt(pendingMatch[1]) : 0,
      totalDelegated: totalMatch ? parseInt(totalMatch[1]) : 0
    }
  } catch (error) {
    logger.error(`Failed to get license summary: ${error}`)
    return {
      checking: 0,
      ready: 0,
      offline: 0,
      banned: 0,
      pending: 0,
      totalDelegated: 0
    }
  }
}

async function approveAllLicenses(logger: any): Promise<void> {
  try {
    const { stdout } = await execAsync('bash -c "cd /opt/aethir-checker && echo \\"aethir license approve --all\\" | timeout 10 ./AethirCheckerCLI"')
    
    if (stdout.includes('License operation approve success')) {
      logger.info('License approval successful')
    } else {
      logger.warn('License approval may not have succeeded')
    }
  } catch (error) {
    logger.error(`Failed to approve licenses: ${error}`)
    throw error
  }
}
