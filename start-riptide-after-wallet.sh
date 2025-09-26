#!/bin/bash

echo "Waiting for wallet.json to be created..."

# Wait for wallet.json to exist
while [ ! -f "/root/wallet.json" ]; do
    echo "Wallet not found, waiting 5 seconds..."
    sleep 5
done

echo "Wallet.json detected! Waiting 1 minute for Aethir installation to complete..."

# Wait 1 minute to ensure Aethir installation is fully complete
sleep 60

echo "Starting Riptide service after delay..."

# Reset the flag so first heartbeat includes wallet keys
rm -f /tmp/wallet_sent_to_orchestrator
echo "Reset wallet sent flag - first heartbeat will include keys"

# Start the Riptide service
systemctl start aethir-riptide-manager

echo "Riptide service started successfully!"
