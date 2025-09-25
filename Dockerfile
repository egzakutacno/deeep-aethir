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
    python3 \
    python3-pip \
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

# Install pexpect and copy automation script
RUN pip3 install pexpect
COPY automate_aethir.py /root/automate_aethir.py
RUN chmod +x /root/automate_aethir.py

# Set the entrypoint to systemd
ENTRYPOINT ["/lib/systemd/systemd"]
