FROM eniocarboni/docker-ubuntu-systemd:jammy

RUN apt-get update && \
    apt-get clean

# Note: Aethir tar file should be copied to container at runtime, not during build
# Installation should happen after container starts with systemd running
