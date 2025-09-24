# DeEEP Network Service for aethir-checker

# ----------------------------------------
# Builder Stage
# ----------------------------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./

# Copy source code and config
COPY tsconfig.json ./
COPY tsup.config.ts ./
COPY src ./src

# Build the application
RUN npm install
RUN npm run build
RUN npm prune --omit=dev

# ----------------------------------------
# Third-party Base
# ----------------------------------------
FROM node:22-alpine AS aethir-checker-base

# Install system dependencies needed for aethir-checker service
RUN apk add --no-cache \
    curl \
    bash \
    procps \
    ca-certificates \
    tar \
    gzip

WORKDIR /app

# Copy and install Aethir checker CLI
COPY AethirCheckerCLI-linux-1.0.3.2.tar.gz /tmp/
RUN cd /tmp && \
    tar -xzf AethirCheckerCLI-linux-1.0.3.2.tar.gz && \
    mv AethirCheckerCLI-linux /opt/aethir-checker && \
    chmod +x /opt/aethir-checker/AethirCheckerCLI && \
    chmod +x /opt/aethir-checker/AethirCheckerService && \
    chmod +x /opt/aethir-checker/install.sh && \
    rm /tmp/AethirCheckerCLI-linux-1.0.3.2.tar.gz

# ----------------------------------------
# Riptide Runtime Layer
# ----------------------------------------
FROM aethir-checker-base AS riptide
RUN addgroup -g 1005 riptide && adduser -u 1005 -G riptide -D riptide
COPY --from=quay.io/nerdnode/riptide:latest /usr/local/bin/riptide /usr/local/bin/riptide
COPY --from=quay.io/nerdnode/riptide:latest /riptide-runtime/ /riptide-runtime/
RUN chmod +x /usr/local/bin/riptide
ENV PATH="/usr/local/bin:$PATH"
RUN mkdir -p /riptide && chown -R riptide:riptide /riptide
COPY --from=builder --chown=riptide:riptide /app/dist /riptide/dist
COPY --from=builder --chown=riptide:riptide /app/node_modules /riptide/node_modules
COPY --from=builder --chown=riptide:riptide /app/package.json /riptide/package.json
COPY --chown=riptide:riptide riptide.config.json /riptide/riptide.config.json

EXPOSE 3000
WORKDIR /riptide
USER riptide
ENV NODE_ENV=production
ENTRYPOINT ["/usr/local/bin/riptide"]
CMD ["start", "--config", "/riptide/riptide.config.json", "--hooks", "/riptide/dist/hooks.js"]
