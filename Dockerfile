FROM eniocarboni/docker-ubuntu-systemd:jammy

RUN apt-get update && \
    apt-get clean

# Copy and extract Aethir checker CLI
COPY files/AethirCheckerCLI-linux-1.0.3.2.tar.gz /root/
RUN cd /root && \
    tar -xzvf AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    mv AethirCheckerCLI-linux /opt/aethir-checker && \
    chmod +x /opt/aethir-checker/AethirCheckerCLI && \
    chmod +x /opt/aethir-checker/AethirCheckerService && \
    chmod +x /opt/aethir-checker/install.sh

# Install Aethir service during build (we'll disable it later)
RUN cd /opt/aethir-checker && ./install.sh

# Install Node.js and Riptide SDK
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g @deeep-network/riptide

# Create Riptide service directory and files
RUN mkdir -p /riptide
COPY aethir-checker/riptide.config.json /riptide/
COPY aethir-checker/dist/hooks.js /riptide/

# Create Riptide systemd service
RUN echo '[Unit]\n\
Description=Riptide Service\n\
After=network.target\n\
\n\
[Service]\n\
Type=simple\n\
User=root\n\
WorkingDirectory=/riptide\n\
ExecStart=/usr/bin/riptide start --config /riptide/riptide.config.json --hooks /riptide/hooks.js\n\
Restart=always\n\
RestartSec=10\n\
\n\
[Install]\n\
WantedBy=multi-user.target' > /etc/systemd/system/riptide.service

# Disable Aethir service auto-start and enable Riptide service during build
RUN systemctl disable aethir-checker && \
    systemctl enable riptide

# Set working directory
WORKDIR /opt/aethir-checker

# Start with systemd as init system (like your original working setup)
CMD ["/lib/systemd/systemd"]