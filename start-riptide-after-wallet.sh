#!/bin/bash

echo "Waiting for wallet.json to be created..."

# Wait for wallet.json to exist
while [ ! -f "/root/wallet.json" ]; do
    echo "Wallet not found, waiting 5 seconds..."
    sleep 5
done

echo "Wallet.json detected! Starting Riptide service..."

# Start the Riptide service
systemctl start aethir-riptide

echo "Riptide service started successfully!"
