#!/bin/bash
set -e

echo "[1/3] Running install.sh ..."
if [ -f /root/AethirCheckerCLI-linux/install.sh ]; then
    bash /root/AethirCheckerCLI-linux/install.sh || echo "install.sh failed, continuing..."
else
    echo "install.sh not found, skipping..."
fi

echo "[2/3] Running wallet automation..."

# Check if wallet already exists
if [ -f "/root/wallet.json" ]; then
    echo "wallet.json already exists. Skipping wallet creation."
    exit 0
fi

# Run the expect automation directly
expect << 'EOF'
set timeout 120

# Run the CLI
spawn /root/AethirCheckerCLI-linux/AethirCheckerCLI

# Accept Terms
expect "Y/N:"
send "y\r"

# Wait for wallet prompt
expect "Aethir>"
send "aethir wallet create\r"

# Wait for "Current private key:" then capture the key (skip the empty line)
expect "Current private key:"
expect "\r\n"
set privkey [gets stdin]

# Wait for "Current public key:" then capture the key (skip the empty line)
expect "Current public key:"
expect "\r\n"
set pubkey [gets stdin]

# Debug: Print what we captured
puts "DEBUG: Captured private key: $privkey"
puts "DEBUG: Captured public key: $pubkey"

# Save to JSON file inside container
set fp [open "/root/wallet.json" "w"]
puts $fp "{"
puts $fp "  \"private_key\": \"$privkey\","
puts $fp "  \"public_key\": \"$pubkey\""
puts $fp "}"
close $fp

puts "Wallet keys saved successfully!"

# Exit the CLI cleanly
send "exit\r"
expect eof
EOF

echo "[3/3] Wallet automation completed!"
