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
        # Save keys to JSON file
        if {$priv_key != "" && $pub_key != ""} {
            set fp [open "/root/wallet.json" "w"]
            puts $fp "\{"
            puts $fp "  \"private_key\": \"$priv_key\","
            puts $fp "  \"public_key\": \"$pub_key\""
            puts $fp "\}"
            close $fp
            send_user "\n✅ Wallet keys saved to /root/wallet.json\n"
        } else {
            send_user "\n❌ Failed to capture wallet keys\n"
        }
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

echo "[3/3] Aethir Checker automation complete."
