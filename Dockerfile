FROM eniocarboni/docker-ubuntu-systemd:jammy

RUN apt-get update && \
    apt-get clean

# Copy and install Aethir checker CLI
COPY files/AethirCheckerCLI-linux-1.0.3.2.tar.gz /root/
RUN cd /root && \
    tar -xzvf AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    cd AethirCheckerCLI-linux && \
    ./install.sh
