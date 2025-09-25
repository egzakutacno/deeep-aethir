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

# Step 2 — Wait for instructions then send wallet creation command
expect {
    -re "Please create a wallet" {
        send_user "DEBUG: Detected instructions, waiting 2 seconds...\n"
        sleep 2
        send_user "DEBUG: Sending command: aethir wallet create\n"
        send "aethir wallet create\r"
        send_user "DEBUG: Command sent successfully, waiting for wallet creation...\n"
        # Wait for wallet creation to complete
        sleep 10
        send_user "DEBUG: Wallet creation should be complete\n"
    }
    timeout {
        send_user "DEBUG: Timeout waiting for instructions\n"
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

echo "[3/3] Looking for wallet file instead of parsing stdout..."

# The CLI saves wallet keys to a file, not stdout!
# Check common locations for wallet files
WALLET_DIRS=("/root/.aethir" "/home/aethir/.aethir" "/root" "/home/aethir")
WALLET_FILES=("wallet.json" "keys.json" "wallet" "private.key" "public.key")

echo "🔍 Searching for wallet files..."

for dir in "${WALLET_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "📁 Checking directory: $dir"
        ls -la "$dir" 2>/dev/null || echo "   (empty or no access)"
        
        for file in "${WALLET_FILES[@]}"; do
            if [ -f "$dir/$file" ]; then
                echo "✅ Found wallet file: $dir/$file"
                echo "📄 File contents:"
                cat "$dir/$file"
                
                # Try to copy to /root/wallet.json
                cp "$dir/$file" /root/wallet.json
                echo "✅ Copied wallet file to /root/wallet.json"
                exit 0
            fi
        done
    fi
done

echo "❌ No wallet files found in common locations"
echo "🔍 Let's check what files were created:"
find /root -name "*wallet*" -o -name "*key*" -o -name "*.json" 2>/dev/null | head -10
find /home -name "*wallet*" -o -name "*key*" -o -name "*.json" 2>/dev/null | head -10

echo "[3/3] Aethir Checker automation complete."
