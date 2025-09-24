"use strict";

// src/hooks.ts
var import_child_process = require("child_process");
var import_child_process2 = require("child_process");
var import_util = require("util");
var execAsync = (0, import_util.promisify)(import_child_process.exec);
module.exports = {
  installSecrets: async ({ env, logger }) => {
    logger.info("Checking Aethir checker configuration");
    return { success: true };
  },
  start: async ({ env, logger }) => {
    logger.info("Starting Aethir checker setup via systemd");
    try {
      logger.info("Running Aethir install.sh script...");
      await execAsync("cd /opt/aethir-checker && ./install.sh");
      logger.info("Aethir service installed and started");
      logger.info("Aethir service is running - wallet creation will be handled by the service");
      logger.info("Aethir checker started successfully");
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
    logger.debug("Reporting Aethir checker status and managing licenses");
    try {
      const currentKeys = await getCurrentWalletKeys(logger);
      const licenseSummary = await getLicenseSummary(logger);
      if (licenseSummary.pending > 0) {
        logger.info(`Found ${licenseSummary.pending} pending licenses, auto-approving`);
        await approveAllLicenses(logger);
        const updatedSummary = await getLicenseSummary(logger);
        logger.info(`License approval completed. New status: ${updatedSummary.ready} ready, ${updatedSummary.pending} pending`);
      }
      return {
        status: "running",
        walletKeys: currentKeys,
        licenseSummary,
        serviceStatus: await getServiceStatus()
      };
    } catch (error) {
      logger.error(`Heartbeat failed: ${error}`);
      return {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        serviceStatus: await getServiceStatus()
      };
    }
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
async function getServiceStatus() {
  try {
    const { stdout } = await execAsync("systemctl is-active aethir-checker");
    return stdout.trim();
  } catch {
    return "inactive";
  }
}
async function getCurrentWalletKeys(logger) {
  return new Promise((resolve) => {
    let outputBuffer = "";
    let keysFound = false;
    execAsync("ps aux | grep AethirCheckerCLI | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true").then(() => {
      setTimeout(() => {
        const aethirProcess = (0, import_child_process2.spawn)("bash", ["-c", 'cd /opt/aethir-checker && echo "aethir wallet export" | timeout 10 ./AethirCheckerCLI'], {
          stdio: ["pipe", "pipe", "pipe"]
        });
        aethirProcess.stdout?.on("data", (data) => {
          outputBuffer += data.toString();
          const privateKeyMatch = outputBuffer.match(/Current private key:\s*\n([^\n]+)/);
          const publicKeyMatch = outputBuffer.match(/Current public key:\s*\n([^\n]+)/);
          if (privateKeyMatch && publicKeyMatch && !keysFound) {
            keysFound = true;
            logger.info("Wallet keys found, sending exit command");
            aethirProcess.stdin.write("aethir exit\n");
            setTimeout(() => {
              aethirProcess.kill("SIGTERM");
              resolve({
                privateKey: privateKeyMatch[1].trim(),
                publicKey: publicKeyMatch[1].trim()
              });
            }, 1e3);
          }
        });
        aethirProcess.on("close", () => {
          if (!keysFound) {
            logger.warn("Could not extract wallet keys from export");
            resolve({});
          }
        });
        aethirProcess.on("error", (error) => {
          logger.error(`Failed to get wallet keys: ${error}`);
          resolve({});
        });
      }, 500);
    }).catch((error) => {
      logger.error(`Failed to kill existing processes: ${error}`);
      resolve({});
    });
  });
}
async function getLicenseSummary(logger) {
  return new Promise((resolve) => {
    let outputBuffer = "";
    let summaryFound = false;
    const aethirProcess = (0, import_child_process2.spawn)("bash", ["-c", 'cd /opt/aethir-checker && echo "aethir license summary" | timeout 10 ./AethirCheckerCLI'], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    aethirProcess.stdout?.on("data", (data) => {
      outputBuffer += data.toString();
      if (outputBuffer.includes("Number") && outputBuffer.includes("Status") && outputBuffer.includes("Total Delegated") && !summaryFound) {
        summaryFound = true;
        const checkingMatch = outputBuffer.match(/(\d+)\s+Checking/);
        const readyMatch = outputBuffer.match(/(\d+)\s+Ready/);
        const offlineMatch = outputBuffer.match(/(\d+)\s+Offline/);
        const bannedMatch = outputBuffer.match(/(\d+)\s+Banned/);
        const pendingMatch = outputBuffer.match(/(\d+)\s+Pending/);
        const totalMatch = outputBuffer.match(/(\d+)\s+Total Delegated/);
        aethirProcess.kill("SIGTERM");
        resolve({
          checking: checkingMatch ? parseInt(checkingMatch[1]) : 0,
          ready: readyMatch ? parseInt(readyMatch[1]) : 0,
          offline: offlineMatch ? parseInt(offlineMatch[1]) : 0,
          banned: bannedMatch ? parseInt(bannedMatch[1]) : 0,
          pending: pendingMatch ? parseInt(pendingMatch[1]) : 0,
          totalDelegated: totalMatch ? parseInt(totalMatch[1]) : 0
        });
      }
    });
    aethirProcess.on("close", () => {
      if (!summaryFound) {
        logger.error("Failed to get license summary - table not found");
        resolve({
          checking: 0,
          ready: 0,
          offline: 0,
          banned: 0,
          pending: 0,
          totalDelegated: 0
        });
      }
    });
    aethirProcess.on("error", (error) => {
      logger.error(`Failed to get license summary: ${error}`);
      resolve({
        checking: 0,
        ready: 0,
        offline: 0,
        banned: 0,
        pending: 0,
        totalDelegated: 0
      });
    });
  });
}
async function approveAllLicenses(logger) {
  return new Promise((resolve, reject) => {
    let outputBuffer = "";
    let approvalFound = false;
    const aethirProcess = (0, import_child_process2.spawn)("bash", ["-c", 'cd /opt/aethir-checker && echo "aethir license approve --all" | timeout 10 ./AethirCheckerCLI'], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    aethirProcess.stdout?.on("data", (data) => {
      outputBuffer += data.toString();
      if (outputBuffer.includes("License operation approve success") && !approvalFound) {
        approvalFound = true;
        logger.info("License approval successful");
        aethirProcess.kill("SIGTERM");
        resolve();
      }
    });
    aethirProcess.on("close", () => {
      if (!approvalFound) {
        logger.warn("License approval may not have succeeded");
        resolve();
      }
    });
    aethirProcess.on("error", (error) => {
      logger.error(`Failed to approve licenses: ${error}`);
      reject(error);
    });
  });
}
//# sourceMappingURL=hooks.js.map