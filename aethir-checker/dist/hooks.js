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
      await execAsync("systemctl start riptide");
      logger.info("Riptide service started");
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
async function setupAethirWallet(logger) {
  logger.info("Setting up Aethir wallet...");
  try {
    await execAsync("systemctl stop aethir-checker 2>/dev/null || true");
    logger.info("Stopped Aethir service before wallet setup");
    await execAsync("ps aux | grep AethirCheckerCLI | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true");
    logger.info("Killed existing CLI processes");
  } catch (error) {
    logger.info("Aethir service/processes were not running or already stopped");
  }
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
      logger.info(`[AETHIR SETUP RAW] ${chunk}`);
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
            if (trimmedLine.includes("Aethir>")) {
              logger.info("Aethir prompt detected, sending wallet create command");
              aethirProcess.stdin.write("aethir wallet create\n");
              state = "waiting_for_keys";
            } else if (trimmedLine.includes("Please create a wallet")) {
              logger.info("Wallet creation message detected, waiting for Aethir prompt");
            } else if (trimmedLine === "") {
              logger.info("Empty line received, continuing to wait");
            } else {
              logger.info(`Unknown line in waiting_for_prompt state: "${trimmedLine}"`);
            }
            break;
          case "waiting_for_keys":
            const privateKeyMatch = trimmedLine.match(/Current private key:\s*$/);
            const publicKeyMatch = trimmedLine.match(/Current public key:\s*$/);
            if (privateKeyMatch) {
              walletKeys.privateKey = "";
              logger.info("Private key start detected");
            } else if (walletKeys.privateKey !== void 0 && !walletKeys.publicKey && trimmedLine.match(/^[A-Za-z0-9+/=\s-]+$/)) {
              walletKeys.privateKey += trimmedLine;
              logger.info("Collecting private key line");
            }
            if (publicKeyMatch) {
              logger.info("Public key label detected");
            } else if (walletKeys.privateKey && !walletKeys.publicKey && trimmedLine.match(/^[a-f0-9]{40}$/)) {
              walletKeys.publicKey = trimmedLine.trim();
              logger.info("Public key extracted: " + walletKeys.publicKey);
            }
            if (trimmedLine.includes("No licenses delegated to your burner wallet")) {
              logger.info("Aethir setup completed - wallet ready");
              if (!walletKeys.publicKey && walletKeys.privateKey) {
                const lines2 = outputBuffer.split("\n");
                for (let i = lines2.length - 1; i >= 0; i--) {
                  const pubKeyMatch = lines2[i].trim().match(/Current public key:\s*(.+)/);
                  if (pubKeyMatch) {
                    walletKeys.publicKey = pubKeyMatch[1].trim();
                    logger.info("Public key extracted from previous line");
                    break;
                  }
                }
              }
              logger.info(`Wallet keys - Private: ${walletKeys.privateKey ? "found" : "missing"}, Public: ${walletKeys.publicKey ? "found" : "missing"}`);
              logger.info("Sending exit command to save wallet files");
              aethirProcess.stdin.write("aethir exit\n");
              state = "waiting_for_exit";
            }
            if (state === "waiting_for_exit" && trimmedLine.includes("Wait a moment, the client is exiting")) {
              logger.info("Aethir CLI exiting cleanly, wallet files saved");
              state = "done";
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
    aethirProcess.on("spawn", () => {
      logger.info("[AETHIR PROCESS] Process spawned successfully");
    });
    aethirProcess.on("error", (error) => {
      logger.error(`[AETHIR PROCESS ERROR] ${error.message}`);
      reject(error);
    });
    aethirProcess.on("close", (code) => {
      logger.info(`[AETHIR PROCESS] Process exited with code ${code}, state: ${state}`);
      if (state === "done" && walletKeys.privateKey && walletKeys.publicKey) {
        logger.info("Aethir setup completed successfully");
        resolve();
      } else {
        logger.error(`Aethir process exited with code ${code}`);
        reject(new Error(`Aethir setup failed with exit code ${code}`));
      }
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