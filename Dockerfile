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
    # Check what we got
    ls -la AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    file AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    # Try extraction (don't fail if it doesn't work)
    tar -xzf AethirCheckerCLI-linux-1.0.3.2.tar.gz || \
    tar -xf AethirCheckerCLI-linux-1.0.3.2.tar.gz || \
    unzip AethirCheckerCLI-linux-1.0.3.2.tar.gz || \
    echo "Extraction failed - will try manual extraction later"

# Set the entrypoint to systemd
ENTRYPOINT ["/lib/systemd/systemd"]
