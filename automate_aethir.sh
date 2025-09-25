#!/bin/bash
set -e

echo "[1/3] Running install.sh ..."

# Go to the Aethir directory and run install.sh
if [ -f "/root/aethir/install.sh" ]; then
    cd /root/aethir || exit
    bash install.sh
else
    echo "❗ install.sh not found in /root/aethir"
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
spawn /root/AethirCheckerCLI-linux

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
    }
}

# Keep session interactive (optional)
interact
EOF

echo "[3/3] Aethir Checker automation complete."
