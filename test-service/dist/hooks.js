"use strict";

// src/hooks.ts
module.exports = {
  installSecrets: async ({ logger }) => {
    logger.info("Installing secrets");
    return { success: true };
  },
  start: async ({ logger }) => {
    logger.info("Service starting");
  },
  health: async ({ logger }) => {
    logger.debug("Health check");
    return true;
  },
  stop: async ({ logger }) => {
    logger.info("Service stopping");
  }
};
//# sourceMappingURL=hooks.js.map