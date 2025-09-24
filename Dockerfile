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
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create aethir user for running the service
RUN useradd -m -s /bin/bash aethir && \
    mkdir -p /home/aethir/.aethir && \
    chown -R aethir:aethir /home/aethir/.aethir

# Set the entrypoint to systemd
ENTRYPOINT ["/lib/systemd/systemd"]
