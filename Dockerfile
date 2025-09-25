# Use Ubuntu 22.04 LTS with systemd support
FROM eniocarboni/docker-ubuntu-systemd:jammy

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC
ENV container=docker

# Update system and install required packages
RUN apt-get update && \
    apt-get install -y \
    curl \
    wget \
    tar \
    gzip \
    unzip \
    file \
    nano \
    expect \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create aethir user for running the service
RUN useradd -m -s /bin/bash aethir && \
    mkdir -p /home/aethir/.aethir && \
    chown -R aethir:aethir /home/aethir/.aethir

# Copy and extract the Aethir Checker CLI during build (but don't install yet)
COPY files/AethirCheckerCLI-linux-1.0.3.2.tar.gz /root/
RUN cd /root && \
    # Debug: Check what was copied
    echo "=== DEBUG: Checking copied file ===" && \
    ls -la AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    file AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    wc -c AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    echo "First 100 bytes:" && \
    head -c 100 AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    echo "=== END DEBUG ===" && \
    # Try extraction (don't fail if it doesn't work)
    tar -xzf AethirCheckerCLI-linux-1.0.3.2.tar.gz || \
    tar -xf AethirCheckerCLI-linux-1.0.3.2.tar.gz || \
    unzip AethirCheckerCLI-linux-1.0.3.2.tar.gz || \
    echo "Extraction failed - will try manual extraction later"

# Create the automation script
RUN echo '#!/bin/bash' > /root/automate_aethir.sh && \
    echo 'set -e' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo 'echo "[1/3] Running install.sh ..."' >> /root/automate_aethir.sh && \
    echo 'if [ -f /root/AethirCheckerCLI-linux/install.sh ]; then' >> /root/automate_aethir.sh && \
    echo '    bash /root/AethirCheckerCLI-linux/install.sh || echo "install.sh failed, continuing..."' >> /root/automate_aethir.sh && \
    echo 'else' >> /root/automate_aethir.sh && \
    echo '    echo "install.sh not found, skipping..."' >> /root/automate_aethir.sh && \
    echo 'fi' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo 'echo "[2/3] Checking for expect..."' >> /root/automate_aethir.sh && \
    echo 'if ! command -v expect >/dev/null 2>&1; then' >> /root/automate_aethir.sh && \
    echo '    echo "Installing expect..."' >> /root/automate_aethir.sh && \
    echo '    apt-get update && apt-get install -y expect' >> /root/automate_aethir.sh && \
    echo 'fi' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo 'echo "[3/3] Running wallet automation..."' >> /root/automate_aethir.sh && \
    echo 'cat << '\''EOF'\'' > /root/aethir_expect.sh' >> /root/automate_aethir.sh && \
    echo '#!/usr/bin/expect -f' >> /root/automate_aethir.sh && \
    echo 'set timeout 30' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo '# If wallet.json already exists, skip' >> /root/automate_aethir.sh && \
    echo 'if {[file exists "/root/wallet.json"]} {' >> /root/automate_aethir.sh && \
    echo '    puts "wallet.json already exists. Skipping wallet creation."' >> /root/automate_aethir.sh && \
    echo '    exit 0' >> /root/automate_aethir.sh && \
    echo '}' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo '# Run the CLI' >> /root/automate_aethir.sh && \
    echo 'spawn /root/AethirCheckerCLI-linux/AethirCheckerCLI' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo '# Accept Terms' >> /root/automate_aethir.sh && \
    echo 'expect "Y/N:"' >> /root/automate_aethir.sh && \
    echo 'send "y\\r"' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo '# Wait for wallet prompt' >> /root/automate_aethir.sh && \
    echo 'expect "Aethir>"' >> /root/automate_aethir.sh && \
    echo 'send "aethir wallet create\\r"' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo '# Capture private key' >> /root/automate_aethir.sh && \
    echo 'expect {' >> /root/automate_aethir.sh && \
    echo '    -re "Current private key:\\r\\n(.*)\\r\\n" {' >> /root/automate_aethir.sh && \
    echo '        set privkey $expect_out(1,string)' >> /root/automate_aethir.sh && \
    echo '    }' >> /root/automate_aethir.sh && \
    echo '}' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo '# Capture public key' >> /root/automate_aethir.sh && \
    echo 'expect {' >> /root/automate_aethir.sh && \
    echo '    -re "Current public key:\\r\\n(.*)\\r\\n" {' >> /root/automate_aethir.sh && \
    echo '        set pubkey $expect_out(1,string)' >> /root/automate_aethir.sh && \
    echo '    }' >> /root/automate_aethir.sh && \
    echo '}' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo '# Save to JSON file inside container' >> /root/automate_aethir.sh && \
    echo 'set fp [open "/root/wallet.json" "w"]' >> /root/automate_aethir.sh && \
    echo 'puts $fp "{"' >> /root/automate_aethir.sh && \
    echo 'puts $fp "  \\"private_key\\": \\"$privkey\\","' >> /root/automate_aethir.sh && \
    echo 'puts $fp "  \\"public_key\\": \\"$pubkey\\""' >> /root/automate_aethir.sh && \
    echo 'puts $fp "}"' >> /root/automate_aethir.sh && \
    echo 'close $fp' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo '# Stop CLI (Ctrl+C)' >> /root/automate_aethir.sh && \
    echo 'send "\\003"' >> /root/automate_aethir.sh && \
    echo 'expect eof' >> /root/automate_aethir.sh && \
    echo 'EOF' >> /root/automate_aethir.sh && \
    echo '' >> /root/automate_aethir.sh && \
    echo 'chmod +x /root/aethir_expect.sh' >> /root/automate_aethir.sh && \
    echo '/root/aethir_expect.sh' >> /root/automate_aethir.sh && \
    chmod +x /root/automate_aethir.sh

# Set the entrypoint to systemd
ENTRYPOINT ["/lib/systemd/systemd"]
