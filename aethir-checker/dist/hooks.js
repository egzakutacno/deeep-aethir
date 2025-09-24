"use strict";

// src/hooks.ts
var import_child_process = require("child_process");
var import_child_process2 = require("child_process");
var import_util = require("util");
var execAsync = (0, import_util.promisify)(import_child_process.exec);
var walletKeys = {};
module.exports = {
  installSecrets: async ({ env, logger }) => {
    logger.info("Checking Aethir checker configuration");
    return { success: true };
  },
  start: async ({ env, logger }) => {
    logger.info("Starting Aethir checker setup via systemd");
    try {
      await setupAethirWallet(logger);
      await startAethirService(logger);
      logger.info("Aethir checker started successfully via systemd");
    } catch (error) {
      logger.error(`Failed to start Aethir checker: ${error}`);
      throw error;
    }
  },
  health: async ({ logger, utils }) => {
    logger.debug("Checking Aethir checker health via systemd");
    try {
      const { stdout } = await execAsync("systemctl is-active aethir-checker");
      return stdout.trim() === "active";
    } catch (error) {
      logger.error(`Health check failed: ${error}`);
      return false;
    }
  },
  heartbeat: async ({ logger }) => {
    logger.debug("Reporting Aethir checker status");
    return {
      status: "running",
      walletKeys,
      serviceStatus: await getServiceStatus()
    };
  },
  stop: async ({ logger, utils }) => {
    logger.info("Stopping Aethir checker via systemd");
    try {
      await execAsync("systemctl stop aethir-checker");
      logger.info("Aethir checker stopped via systemd");
    } catch (error) {
      logger.error(`Failed to stop Aethir checker: ${error}`);
    }
  }
};
async function setupAethirWallet(logger) {
  logger.info("Setting up Aethir wallet...");
  return new Promise((resolve, reject) => {
    let outputBuffer = "";
    let state = "waiting_for_terms";
    const aethirProcess = (0, import_child_process2.spawn)("./AethirCheckerCLI", {
      cwd: "/opt/aethir-checker",
      stdio: ["pipe", "pipe", "pipe"]
    });
    aethirProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      outputBuffer += chunk;
      logger.info(`[AETHIR SETUP] ${chunk.trim()}`);
      const lines = outputBuffer.split("\n");
      outputBuffer = lines.pop() || "";
      for (const line of lines) {
        const trimmedLine = line.trim();
        switch (state) {
          case "waiting_for_terms":
            if (trimmedLine.includes("Press y to continue") || trimmedLine.includes("Y/N:")) {
              logger.info('Terms prompt detected, sending "y"');
              aethirProcess.stdin.write("y\n");
              state = "waiting_for_prompt";
            }
            break;
          case "waiting_for_prompt":
            logger.info(`Waiting for prompt, current line: "${trimmedLine}"`);
            if (trimmedLine.includes("Please create a wallet")) {
              logger.info("Wallet creation prompt detected, sending wallet create command");
              aethirProcess.stdin.write("aethir wallet create\n");
              state = "waiting_for_keys";
            }
            break;
          case "waiting_for_keys":
            const privateKeyMatch = trimmedLine.match(/Current private key:\s*(.*)/);
            const publicKeyMatch = trimmedLine.match(/Current public key:\s*(.+)/);
            if (privateKeyMatch) {
              if (privateKeyMatch[1].trim()) {
                walletKeys.privateKey = privateKeyMatch[1].trim();
              } else {
                walletKeys.privateKey = "";
              }
              logger.info("Private key start detected");
            } else if (walletKeys.privateKey !== void 0 && !walletKeys.publicKey && trimmedLine.match(/^[A-Za-z0-9+/=\s-]+$/)) {
              walletKeys.privateKey += trimmedLine;
            }
            if (publicKeyMatch) {
              walletKeys.publicKey = publicKeyMatch[1].trim();
              logger.info("Public key extracted");
            }
            if (walletKeys.privateKey && walletKeys.publicKey) {
              logger.info("Wallet keys extracted successfully");
              logger.info(`Private key length: ${walletKeys.privateKey.length}`);
              logger.info(`Public key: ${walletKeys.publicKey}`);
              state = "done";
              aethirProcess.kill("SIGTERM");
            }
            break;
        }
      }
    });
    aethirProcess.stderr.on("data", (data) => {
      logger.error(`[AETHIR ERROR] ${data.toString()}`);
    });
    aethirProcess.on("close", (code) => {
      if (state === "done" && walletKeys.privateKey && walletKeys.publicKey) {
        logger.info("Aethir setup completed successfully");
        resolve();
      } else {
        logger.error(`Aethir process exited with code ${code}`);
        reject(new Error(`Aethir setup failed with exit code ${code}`));
      }
    });
    aethirProcess.on("error", (error) => {
      logger.error(`Aethir process error: ${error.message}`);
      reject(error);
    });
    setTimeout(() => {
      if (state !== "done") {
        logger.error("Aethir setup timed out");
        aethirProcess.kill("SIGTERM");
        reject(new Error("Aethir setup timed out"));
      }
    }, 3e4);
  });
}
async function startAethirService(logger) {
  logger.info("Starting Aethir checker service via systemd...");
  try {
    await execAsync("systemctl start aethir-checker");
    logger.info("Aethir service started via systemd");
  } catch (error) {
    logger.error(`Failed to start Aethir service: ${error}`);
    throw error;
  }
}
async function getServiceStatus() {
  try {
    const { stdout } = await execAsync("systemctl is-active aethir-checker");
    return stdout.trim();
  } catch {
    return "inactive";
  }
}
//# sourceMappingURL=hooks.js.map