#!/bin/bash
set -e

echo "[1/3] Running install.sh ..."

# Correct install.sh path
INSTALL_PATH="/root/AethirCheckerCLI-linux/install.sh"
if [ -f "$INSTALL_PATH" ]; then
    bash "$INSTALL_PATH"
else
    echo "❗ install.sh not found at $INSTALL_PATH"
    exit 1
fi

echo "[2/3] Running wallet automation..."

# Ensure expect is installed
if ! command -v expect &> /dev/null; then
    echo "Installing expect..."
    apt update && apt install -y expect
fi

# Automate Aethir CLI interaction
expect << 'EOF'
spawn /root/AethirCheckerCLI-linux/AethirCheckerCLI

# Step 1 — Accept Terms of Service once
expect {
    -re "Y/N:" {
        sleep 1
        send "y\r"
    }
}

# Step 2 — Wait for "Aethir> " prompt then send wallet creation command
expect {
    -re "Aethir> " {
        send_user "DEBUG: Detected Aethir> prompt, sending command...\n"
        sleep 1
        send "aethir wallet create\r"
        send_user "DEBUG: Command sent: aethir wallet create\n"
    }
}

# Step 4 — Wait for wallet creation to finish and prompt to return
expect -re "Aethir> "

send_user "\n✅ Wallet creation complete, CLI ready.\n"

# Step 5 — Stop automation here
EOF

echo "[3/3] Aethir Checker automation complete."
