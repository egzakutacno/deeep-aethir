FROM eniocarboni/docker-ubuntu-systemd:jammy

RUN apt-get update && \
    apt-get install -y wget ntpdate netbase && \
    apt-get clean

# Copy and extract Aethir checker CLI (install script will run at container startup)
COPY files/AethirCheckerCLI-linux-1.0.3.2.tar.gz /root/
RUN cd /root && \
    tar -xzvf AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    mv AethirCheckerCLI-linux /opt/aethir-checker && \
    chmod +x /opt/aethir-checker/AethirCheckerCLI && \
    chmod +x /opt/aethir-checker/AethirCheckerService && \
    chmod +x /opt/aethir-checker/install.sh

# Create startup script that will install and start systemd
RUN echo '#!/bin/bash\n\
cd /opt/aethir-checker\n\
./install.sh\n\
exec /lib/systemd/systemd' > /start.sh && \
    chmod +x /start.sh

# Set working directory
WORKDIR /opt/aethir-checker

# Start with systemd as init system
CMD ["/start.sh"]
