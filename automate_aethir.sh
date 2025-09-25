#!/bin/bash

# Ensure the script exits on any error
set -e

echo "[1/3] Running install.sh ..."

# Run the installation first
INSTALL_PATH="/root/AethirCheckerCLI-linux/install.sh"
if [ -f "$INSTALL_PATH" ]; then
    bash "$INSTALL_PATH"
else
    echo "❗ install.sh not found at $INSTALL_PATH"
    exit 1
fi

echo "[2/3] Running wallet automation..."

# Install expect if not already installed
if ! command -v expect &>/dev/null; then
    echo "Installing expect..."
    apt-get update && apt-get install -y expect
fi

# Define the expect script content
cat <<'EOF' > /tmp/wallet_auto.exp
#!/usr/bin/expect -f
set timeout 120

# Start the CLI
spawn /root/AethirCheckerCLI-linux/AethirCheckerCLI

# Accept Terms of Service
expect {
    -re "Y/N:" { 
        send "y\r"
        exp_continue
    }
}

# Wait for instructions and send wallet create command
expect {
    -re "Please create a wallet" {
        send "aethir wallet create\r"
        exp_continue
    }
}

# Wait for wallet creation to complete
expect {
    -re "Aethir>" {
        send "aethir wallet export\r"
        exp_continue
    }
}

# Capture the export output
expect {
    -re "Private key: (.*)" {
        set priv_key $expect_out(1,string)
        exp_continue
    }
    -re "Public key: (.*)" {
        set pub_key $expect_out(1,string)
        exp_continue
    }
    -re "Aethir>" {
        # Save keys to file
        set wallet_file [open "/root/wallet.json" w]
        puts $wallet_file "{\n  \"private_key\": \"$priv_key\",\n  \"public_key\": \"$pub_key\"\n}"
        close $wallet_file
        send "exit\r"
        expect eof
    }
}
EOF

# Make the expect script executable
chmod +x /tmp/wallet_auto.exp

# Run the expect script
echo "🚀 Running wallet automation..."
/tmp/wallet_auto.exp

echo "[3/3] Wallet automation complete!"

# Check if wallet.json was created and contains keys
if [ -f "/root/wallet.json" ]; then
    echo "✅ Wallet created successfully. Contents:"
    cat /root/wallet.json
else
    echo "❌ Wallet creation failed. /root/wallet.json not found."
    exit 1
fi