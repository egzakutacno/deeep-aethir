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

# Step 1 — Accept Terms of Service
expect {
    -re "Y/N:" {
        sleep 1
        send "y\r"
        exp_continue
    }
}

# Step 2 — Wait for CLI prompt and create wallet
expect {
    -re "Aethir> " {
        send "aethir wallet create\r"
        exp_continue
    }
}

# Step 3 — Wait until wallet creation completes
expect {
    -re "Aethir> " {
        send_user "✅ Wallet creation complete.\n"
    }
}

# Optional — keep CLI interactive after automation
interact
EOF

echo "[3/3] Aethir Checker automation complete."
