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

# Install Node.js 22 (required for Riptide)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

# Install Riptide SDK globally
RUN npm install -g @deeep-network/riptide@latest

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

# Copy automation script
COPY automate_aethir.sh /root/automate_aethir.sh
RUN chmod +x /root/automate_aethir.sh

# Copy Riptide configuration and hooks
COPY riptide.config.json /root/riptide.config.json
COPY src/hooks.js /root/src/hooks.js
RUN mkdir -p /root/src && chmod +x /root/src/hooks.js

# Copy Riptide systemd service (disabled by default)
COPY aethir-riptide.service /etc/systemd/system/aethir-riptide.service

# Copy wallet watcher script and service
COPY start-riptide-after-wallet.sh /root/start-riptide-after-wallet.sh
RUN chmod +x /root/start-riptide-after-wallet.sh
COPY aethir-wallet-watcher.service /etc/systemd/system/aethir-wallet-watcher.service
RUN systemctl enable aethir-wallet-watcher.service

# Set the entrypoint to systemd
ENTRYPOINT ["/lib/systemd/systemd"]
