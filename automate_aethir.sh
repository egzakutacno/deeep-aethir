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
set timeout 60
log_file -noappend /tmp/aethir_interaction.log
spawn /root/AethirCheckerCLI-linux/AethirCheckerCLI

send_user "DEBUG: CLI spawned, waiting for Y/N prompt...\n"

# Step 1 — Accept Terms of Service once
expect {
    -re "Y/N:" {
        send_user "DEBUG: Detected Y/N prompt, sending y...\n"
        sleep 1
        send "y\r"
    }
    timeout {
        send_user "DEBUG: Timeout waiting for Y/N prompt\n"
        exit 1
    }
}

send_user "DEBUG: Waiting for Aethir> prompt...\n"

# Step 2 — Wait for "Aethir> " prompt then send wallet creation command
expect {
    -re "Aethir> " {
        send_user "DEBUG: Detected Aethir> prompt, waiting 3 seconds...\n"
        sleep 3
        send_user "DEBUG: Sending command: aethir wallet create\n"
        send "aethir wallet create\r"
        send_user "DEBUG: Command sent successfully, waiting for wallet creation to start...\n"
        # Wait a bit more to ensure the command is processed
        sleep 5
    }
    timeout {
        send_user "DEBUG: Timeout waiting for Aethir> prompt\n"
        exit 1
    }
}

send_user "DEBUG: Waiting for wallet creation to complete...\n"

# Step 4 — Wait for wallet creation to finish and capture keys
set priv_key ""
set pub_key ""

expect {
    -re "Current private key:\r?\n(.*?)\r?\n" {
        set priv_key $expect_out(1,string)
        send_user "DEBUG: Private key captured\n"
        exp_continue
    }
    -re "Current public key:\r?\n(.*?)\r?\n" {
        set pub_key $expect_out(1,string)
        send_user "DEBUG: Public key captured\n"
        exp_continue
    }
    -re "No licenses delegated to your burner wallet" {
        send_user "DEBUG: Wallet creation completed, saving keys...\n"
        exp_continue
    }
    -re "Aethir> " {
        send_user "✅ Wallet creation complete, CLI ready.\n"
        interact
    }
    timeout {
        send_user "DEBUG: Timeout waiting for wallet creation completion\n"
        exit 1
    }
}

# Step 5 — Stop automation here
EOF

echo "[3/3] Extracting wallet keys from interaction log..."

# Debug: Check if log file exists
echo "DEBUG: Checking for log file..."
if [ -f "/tmp/aethir_interaction.log" ]; then
    echo "✅ Log file exists"
    echo "DEBUG: Log file contents:"
    cat /tmp/aethir_interaction.log
    echo "DEBUG: End of log file"
    
    # Extract private key (the line after "Current private key:")
    PRIV_KEY=$(grep -A1 "Current private key:" /tmp/aethir_interaction.log | tail -n1 | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Extract public key (the line after "Current public key:")
    PUB_KEY=$(grep -A1 "Current public key:" /tmp/aethir_interaction.log | tail -n1 | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    echo "DEBUG: Extracted private key: '$PRIV_KEY'"
    echo "DEBUG: Extracted public key: '$PUB_KEY'"
    
    # Save to JSON file
    if [ ! -z "$PRIV_KEY" ] && [ ! -z "$PUB_KEY" ]; then
        cat > /root/wallet.json << JSON_EOF
{
  "private_key": "$PRIV_KEY",
  "public_key": "$PUB_KEY"
}
JSON_EOF
        echo "✅ Wallet keys saved to /root/wallet.json"
        echo "Private key: ${PRIV_KEY:0:50}..."
        echo "Public key: $PUB_KEY"
    else
        echo "❌ Failed to extract wallet keys from log"
        echo "Debug: Checking log file..."
        echo "Private key found: $([ ! -z "$PRIV_KEY" ] && echo "Yes" || echo "No")"
        echo "Public key found: $([ ! -z "$PUB_KEY" ] && echo "Yes" || echo "No")"
    fi
else
    echo "❌ Interaction log not found at /tmp/aethir_interaction.log"
    echo "DEBUG: Available log files:"
    ls -la /tmp/*.log 2>/dev/null || echo "No log files found"
fi

echo "[3/3] Aethir Checker automation complete."
