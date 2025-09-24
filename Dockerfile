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
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create aethir user for running the service
RUN useradd -m -s /bin/bash aethir && \
    mkdir -p /home/aethir/.aethir && \
    chown -R aethir:aethir /home/aethir/.aethir

# Download and extract the Aethir Checker CLI during build (but don't install yet)
RUN cd /root && \
    # Check what we're downloading first
    curl -L -v -o AethirCheckerCLI-linux-1.0.3.2.tar.gz \
    https://github.com/Aethir/AethirCheckerCLI/releases/download/v1.0.3.2/AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    # Check file type and size
    ls -la AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    file AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    # Try different extraction methods
    (tar -xzf AethirCheckerCLI-linux-1.0.3.2.tar.gz || \
     tar -xf AethirCheckerCLI-linux-1.0.3.2.tar.gz || \
     unzip AethirCheckerCLI-linux-1.0.3.2.tar.gz || \
     echo "Extraction failed, keeping tarball for manual extraction") && \
    # Don't clean up the tarball if extraction failed
    echo "Download completed"

# Set the entrypoint to systemd
ENTRYPOINT ["/lib/systemd/systemd"]
