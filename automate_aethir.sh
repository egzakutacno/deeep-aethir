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

# Record the session and parse the output using script command
echo "Starting Aethir CLI session..."
script -q /tmp/aethir_session.log -c '/root/AethirCheckerCLI-linux/AethirCheckerCLI' << 'EOF'
y
aethir wallet create
exit
EOF

echo "Session completed. Parsing output..."

# Parse the log file for keys
privkey=$(grep -A1 "Current private key:" /tmp/aethir_session.log | tail -n1 | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
pubkey=$(grep -A1 "Current public key:" /tmp/aethir_session.log | tail -n1 | tr -d '\r\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

echo "DEBUG: Captured private key: $privkey"
echo "DEBUG: Captured public key: $pubkey"

# Save to JSON file
cat > /root/wallet.json << JSON_EOF
{
  "private_key": "$privkey",
  "public_key": "$pubkey"
}
JSON_EOF

echo "Wallet keys saved successfully!"

# Clean up
rm -f /tmp/aethir_session.log

echo "[3/3] Wallet automation completed!"
