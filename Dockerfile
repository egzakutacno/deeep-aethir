# Use Ubuntu 22.04 LTS with systemd support
FROM eniocarboni/docker-ubuntu-systemd:jammy

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Update system and install required packages
RUN apt-get update && \
    apt-get install -y \
    curl \
    wget \
    tar \
    gzip \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /root

# Copy the Aethir Checker CLI tarball
COPY files/AethirCheckerCLI-linux-1.0.3.2.tar.gz /root/

# Extract and manually install Aethir Checker CLI (skip install.sh to avoid systemd issues during build)
RUN tar -xzvf AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    cd AethirCheckerCLI-linux && \
    # Copy binaries to /usr/local/bin
    cp AethirCheckerCLI /usr/local/bin/aethir-checker && \
    cp AethirCheckerService /usr/local/bin/aethir-checker-service && \
    # Make binaries executable
    chmod +x /usr/local/bin/aethir-checker && \
    chmod +x /usr/local/bin/aethir-checker-service && \
    # Copy config files to /etc/aethir
    mkdir -p /etc/aethir && \
    cp -r config/* /etc/aethir/ && \
    cp -r benchmark /etc/aethir/ && \
    cd /root && \
    rm -rf AethirCheckerCLI-linux-1.0.3.2.tar.gz AethirCheckerCLI-linux

# Create aethir user for running the service
RUN useradd -m -s /bin/bash aethir && \
    mkdir -p /home/aethir/.aethir && \
    chown -R aethir:aethir /home/aethir/.aethir

# Set up systemd service for Aethir Checker
RUN echo '[Unit]' > /etc/systemd/system/aethir-checker.service && \
    echo 'Description=Aethir Checker Service' >> /etc/systemd/system/aethir-checker.service && \
    echo 'After=network.target' >> /etc/systemd/system/aethir-checker.service && \
    echo '' >> /etc/systemd/system/aethir-checker.service && \
    echo '[Service]' >> /etc/systemd/system/aethir-checker.service && \
    echo 'Type=simple' >> /etc/systemd/system/aethir-checker.service && \
    echo 'User=aethir' >> /etc/systemd/system/aethir-checker.service && \
    echo 'Group=aethir' >> /etc/systemd/system/aethir-checker.service && \
    echo 'WorkingDirectory=/home/aethir' >> /etc/systemd/system/aethir-checker.service && \
    echo 'ExecStart=/usr/local/bin/aethir-checker-service' >> /etc/systemd/system/aethir-checker.service && \
    echo 'Environment=HOME=/home/aethir' >> /etc/systemd/system/aethir-checker.service && \
    echo 'Restart=always' >> /etc/systemd/system/aethir-checker.service && \
    echo 'RestartSec=10' >> /etc/systemd/system/aethir-checker.service && \
    echo 'StandardOutput=journal' >> /etc/systemd/system/aethir-checker.service && \
    echo 'StandardError=journal' >> /etc/systemd/system/aethir-checker.service && \
    echo '' >> /etc/systemd/system/aethir-checker.service && \
    echo '[Install]' >> /etc/systemd/system/aethir-checker.service && \
    echo 'WantedBy=multi-user.target' >> /etc/systemd/system/aethir-checker.service

# Enable the service
RUN systemctl enable aethir-checker

# Create startup script
RUN echo '#!/bin/bash' > /usr/local/bin/start-aethir.sh && \
    echo 'set -e' >> /usr/local/bin/start-aethir.sh && \
    echo '' >> /usr/local/bin/start-aethir.sh && \
    echo '# Start systemd' >> /usr/local/bin/start-aethir.sh && \
    echo 'exec /lib/systemd/systemd' >> /usr/local/bin/start-aethir.sh && \
    chmod +x /usr/local/bin/start-aethir.sh

# Expose any necessary ports (if Aethir Checker uses any)
# EXPOSE 8080

# Set the entrypoint
ENTRYPOINT ["/usr/local/bin/start-aethir.sh"]
