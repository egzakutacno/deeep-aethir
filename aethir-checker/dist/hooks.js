"use strict";

// src/hooks.ts
var import_child_process = require("child_process");
var aethirProcess = null;
var walletKeys = {};
module.exports = {
  installSecrets: async ({ env, logger }) => {
    logger.info("Checking Aethir checker configuration");
    return { success: true };
  },
  start: async ({ env, logger }) => {
    logger.info("Starting Aethir checker setup and service");
    try {
      await setupAethirWallet(logger);
      await startAethirService(logger);
      logger.info("Aethir checker started successfully");
    } catch (error) {
      logger.error(`Failed to start Aethir checker: ${error}`);
      throw error;
    }
  },
  health: async ({ logger, utils }) => {
    logger.debug("Checking Aethir checker health");
    if (!aethirProcess || !aethirProcess.pid) {
      return false;
    }
    try {
      process.kill(aethirProcess.pid, 0);
      return true;
    } catch {
      return false;
    }
  },
  heartbeat: async ({ logger }) => {
    logger.debug("Reporting Aethir checker status");
    return {
      status: "running",
      walletKeys,
      processId: aethirProcess?.pid || null
    };
  },
  stop: async ({ logger, utils }) => {
    logger.info("Stopping Aethir checker process");
    if (aethirProcess && aethirProcess.pid) {
      try {
        process.kill(aethirProcess.pid, "SIGTERM");
        await utils.sleep(2e3);
        try {
          process.kill(aethirProcess.pid, 0);
          process.kill(aethirProcess.pid, "SIGKILL");
          logger.warn("Had to force kill Aethir process");
        } catch {
          logger.info("Aethir process stopped gracefully");
        }
      } catch (error) {
        logger.debug("Aethir process already stopped");
      }
    }
    aethirProcess = null;
  }
};
async function setupAethirWallet(logger) {
  return new Promise((resolve, reject) => {
    logger.info("Setting up Aethir wallet...");
    const setupProcess = (0, import_child_process.spawn)("bash", ["-c", `
      cd /opt/aethir-checker && 
      echo "y" | ./AethirCheckerCLI
    `], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let output = "";
    setupProcess.stdout?.on("data", (data) => {
      output += data.toString();
      logger.info(`[AETHIR SETUP] ${data.toString().trim()}`);
    });
    setupProcess.stderr?.on("data", (data) => {
      logger.error(`[AETHIR SETUP ERROR] ${data.toString().trim()}`);
    });
    setupProcess.on("close", (code) => {
      if (code === 0) {
        const privateKeyMatch = output.match(/Current private key:\s*([^\n]+)/);
        const publicKeyMatch = output.match(/Current public key:\s*([^\n]+)/);
        if (privateKeyMatch && publicKeyMatch) {
          walletKeys.privateKey = privateKeyMatch[1].trim();
          walletKeys.publicKey = publicKeyMatch[1].trim();
          logger.info("Wallet keys extracted successfully");
          resolve();
        } else {
          logger.error("Failed to extract wallet keys from output");
          reject(new Error("Wallet key extraction failed"));
        }
      } else {
        logger.error(`Aethir setup failed with code ${code}`);
        reject(new Error(`Setup process exited with code ${code}`));
      }
    });
    setupProcess.on("error", (error) => {
      logger.error(`Failed to start Aethir setup: ${error.message}`);
      reject(error);
    });
  });
}
async function startAethirService(logger) {
  return new Promise((resolve, reject) => {
    logger.info("Starting Aethir checker service...");
    aethirProcess = (0, import_child_process.spawn)("/opt/aethir-checker/AethirCheckerCLI", [], {
      cwd: "/opt/aethir-checker",
      detached: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    aethirProcess.on("spawn", () => {
      logger.info(`Aethir service started with PID: ${aethirProcess?.pid}`);
      resolve();
    });
    aethirProcess.on("error", (error) => {
      logger.error(`Failed to start Aethir service: ${error.message}`);
      reject(error);
    });
    aethirProcess.stdout?.on("data", (data) => {
      logger.info(`[AETHIR] ${data.toString().trim()}`);
    });
    aethirProcess.stderr?.on("data", (data) => {
      logger.error(`[AETHIR ERROR] ${data.toString().trim()}`);
    });
    aethirProcess.unref();
  });
}
//# sourceMappingURL=hooks.js.map