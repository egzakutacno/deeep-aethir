import type { HookContext } from '@deeep-network/riptide'

module.exports = {
  installSecrets: async ({ logger }: HookContext) => {
    logger.info('Installing secrets')
    return { success: true }
  },

  start: async ({ logger }: HookContext) => {
    logger.info('Service starting')
  },

  health: async ({ logger }: HookContext) => {
    logger.debug('Health check')
    return true
  },

  stop: async ({ logger }: HookContext) => {
    logger.info('Service stopping')
  }
}
