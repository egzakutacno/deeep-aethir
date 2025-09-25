#!/bin/bash
set -e

echo "[1/3] Running install.sh ..."
if [ -f /root/AethirCheckerCLI-linux/install.sh ]; then
    bash /root/AethirCheckerCLI-linux/install.sh || echo "install.sh failed, continuing..."
else
    echo "install.sh not found, skipping..."
fi

echo "[2/3] Running wallet automation..."
cat << 'EOF' > /root/aethir_expect.sh
#!/usr/bin/expect -f
set timeout 120

# If wallet.json already exists, skip
if {[file exists "/root/wallet.json"]} {
    puts "wallet.json already exists. Skipping wallet creation."
    exit 0
}

# Run the CLI
spawn /root/AethirCheckerCLI-linux/AethirCheckerCLI

# Accept Terms
expect "Y/N:"
send "y\r"

# Wait for wallet prompt
expect "Aethir>"
send "aethir wallet create\r"

# Wait for "Current private key:" then skip the empty line and capture the key
expect "Current private key:"
expect "\r\n"
set privkey [gets stdin]

# Wait for "Current public key:" then skip the empty line and capture the key  
expect "Current public key:"
expect "\r\n"
set pubkey [gets stdin]

# Save to JSON file inside container
set fp [open "/root/wallet.json" "w"]
puts $fp "{"
puts $fp "  \"private_key\": \"$privkey\","
puts $fp "  \"public_key\": \"$pubkey\""
puts $fp "}"
close $fp

# Stop CLI (Ctrl+C)
send "\003"
expect eof
EOF

chmod +x /root/aethir_expect.sh
echo "[3/3] Running expect script..."
/root/aethir_expect.sh
