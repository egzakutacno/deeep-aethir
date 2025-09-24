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
  
  // Stop Aethir service first to avoid conflicts
  try {
    await execAsync('systemctl stop aethir-checker 2>/dev/null || true')
    logger.info('Stopped Aethir service before wallet setup')
  } catch (error) {
    logger.info('Aethir service was not running or already stopped')
  }
  
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
            const privateKeyMatch = trimmedLine.match(/Current private key:\s*$/)
            const publicKeyMatch = trimmedLine.match(/Current public key:\s*$/)
            
            if (privateKeyMatch) {
              // Private key label detected, start collecting
              walletKeys.privateKey = ''
              logger.info('Private key start detected')
            } else if (walletKeys.privateKey !== undefined && !walletKeys.publicKey && trimmedLine.match(/^[A-Za-z0-9+/=\s-]+$/)) {
              // Collect private key lines (base64 content)
              walletKeys.privateKey += trimmedLine
              logger.info('Collecting private key line')
            }
            
            if (publicKeyMatch) {
              // Public key label detected, next line will be the key
              logger.info('Public key label detected')
            } else if (walletKeys.privateKey && !walletKeys.publicKey && trimmedLine.match(/^[a-f0-9]{40}$/)) {
              // Public key appears on the line after "Current public key:" (40 hex chars)
              walletKeys.publicKey = trimmedLine.trim()
              logger.info('Public key extracted: ' + walletKeys.publicKey)
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
  return new Promise((resolve) => {
    let outputBuffer = ''
    let keysFound = false
    
    // Kill any existing CLI processes first
    execAsync('ps aux | grep AethirCheckerCLI | grep -v grep | awk \'{print $2}\' | xargs kill -9 2>/dev/null || true').then(() => {
      // Wait a moment for process to fully terminate
      setTimeout(() => {
        const aethirProcess = spawn('bash', ['-c', 'cd /opt/aethir-checker && echo "aethir wallet export" | timeout 10 ./AethirCheckerCLI'], {
          stdio: ['pipe', 'pipe', 'pipe']
        })
        
        aethirProcess.stdout?.on('data', (data: Buffer) => {
          outputBuffer += data.toString()
          
          // Look for wallet keys in the output (keys are on separate lines)
          const privateKeyMatch = outputBuffer.match(/Current private key:\s*\n([^\n]+)/)
          const publicKeyMatch = outputBuffer.match(/Current public key:\s*\n([^\n]+)/)
          
          if (privateKeyMatch && publicKeyMatch && !keysFound) {
            keysFound = true
            logger.info('Wallet keys found, sending exit command')
            
            // Send exit command to cleanly close the CLI
            aethirProcess.stdin.write('aethir exit\n')
            
            // Wait a moment for exit to complete, then resolve
            setTimeout(() => {
              aethirProcess.kill('SIGTERM')
              resolve({
                privateKey: privateKeyMatch[1].trim(),
                publicKey: publicKeyMatch[1].trim()
              })
            }, 1000)
          }
        })
        
        aethirProcess.on('close', () => {
          if (!keysFound) {
            logger.warn('Could not extract wallet keys from export')
            resolve({})
          }
        })
        
        aethirProcess.on('error', (error: Error) => {
          logger.error(`Failed to get wallet keys: ${error}`)
          resolve({})
        })
      }, 500) // Wait 500ms after killing processes
    }).catch((error) => {
      logger.error(`Failed to kill existing processes: ${error}`)
      resolve({})
    })
  })
}

async function getLicenseSummary(logger: any): Promise<{
  checking: number;
  ready: number;
  offline: number;
  banned: number;
  pending: number;
  totalDelegated: number;
}> {
  return new Promise((resolve) => {
    let outputBuffer = ''
    let summaryFound = false
    
    const aethirProcess = spawn('bash', ['-c', 'cd /opt/aethir-checker && echo "aethir license summary" | timeout 10 ./AethirCheckerCLI'], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    aethirProcess.stdout?.on('data', (data: Buffer) => {
      outputBuffer += data.toString()
      
      // Look for license summary table
      if (outputBuffer.includes('Number') && outputBuffer.includes('Status') && outputBuffer.includes('Total Delegated') && !summaryFound) {
        summaryFound = true
        
        // Parse license summary output
        const checkingMatch = outputBuffer.match(/(\d+)\s+Checking/)
        const readyMatch = outputBuffer.match(/(\d+)\s+Ready/)
        const offlineMatch = outputBuffer.match(/(\d+)\s+Offline/)
        const bannedMatch = outputBuffer.match(/(\d+)\s+Banned/)
        const pendingMatch = outputBuffer.match(/(\d+)\s+Pending/)
        const totalMatch = outputBuffer.match(/(\d+)\s+Total Delegated/)
        
        aethirProcess.kill('SIGTERM')
        resolve({
          checking: checkingMatch ? parseInt(checkingMatch[1]) : 0,
          ready: readyMatch ? parseInt(readyMatch[1]) : 0,
          offline: offlineMatch ? parseInt(offlineMatch[1]) : 0,
          banned: bannedMatch ? parseInt(bannedMatch[1]) : 0,
          pending: pendingMatch ? parseInt(pendingMatch[1]) : 0,
          totalDelegated: totalMatch ? parseInt(totalMatch[1]) : 0
        })
      }
    })
    
    aethirProcess.on('close', () => {
      if (!summaryFound) {
        logger.error('Failed to get license summary - table not found')
        resolve({
          checking: 0,
          ready: 0,
          offline: 0,
          banned: 0,
          pending: 0,
          totalDelegated: 0
        })
      }
    })
    
    aethirProcess.on('error', (error: Error) => {
      logger.error(`Failed to get license summary: ${error}`)
      resolve({
        checking: 0,
        ready: 0,
        offline: 0,
        banned: 0,
        pending: 0,
        totalDelegated: 0
      })
    })
  })
}

async function approveAllLicenses(logger: any): Promise<void> {
  return new Promise((resolve, reject) => {
    let outputBuffer = ''
    let approvalFound = false
    
    const aethirProcess = spawn('bash', ['-c', 'cd /opt/aethir-checker && echo "aethir license approve --all" | timeout 10 ./AethirCheckerCLI'], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    aethirProcess.stdout?.on('data', (data: Buffer) => {
      outputBuffer += data.toString()
      
      // Look for approval success message
      if (outputBuffer.includes('License operation approve success') && !approvalFound) {
        approvalFound = true
        logger.info('License approval successful')
        aethirProcess.kill('SIGTERM')
        resolve()
      }
    })
    
    aethirProcess.on('close', () => {
      if (!approvalFound) {
        logger.warn('License approval may not have succeeded')
        resolve() // Don't reject, just warn
      }
    })
    
    aethirProcess.on('error', (error: Error) => {
      logger.error(`Failed to approve licenses: ${error}`)
      reject(error)
    })
  })
}
