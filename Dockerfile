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

# Create Aethir service file manually (install.sh requires systemd to be running)
RUN echo '[Unit]\n\
Description=aethir checker client service\n\
After=network.target\n\
\n\
[Service]\n\
Type=simple\n\
User=root\n\
WorkingDirectory=/opt/aethir-checker\n\
ExecStart=/opt/aethir-checker/AethirCheckerService\n\
Restart=always\n\
RestartSec=5\n\
\n\
[Install]\n\
WantedBy=multi-user.target' > /etc/systemd/system/aethir-checker.service

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

# Create symlinks to disable Aethir and enable Riptide (systemctl won't work during build)
RUN rm -f /etc/systemd/system/multi-user.target.wants/aethir-checker.service && \
    ln -s /etc/systemd/system/riptide.service /etc/systemd/system/multi-user.target.wants/riptide.service

# Set working directory
WORKDIR /opt/aethir-checker

# Start with systemd as init system (like your original working setup)
CMD ["/lib/systemd/systemd"]