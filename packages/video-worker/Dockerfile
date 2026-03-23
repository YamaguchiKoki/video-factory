FROM node:22-bookworm-slim

# Install system dependencies for Chromium (required by Remotion)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    curl \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.25.0 --activate

WORKDIR /app

# Copy workspace root files for pnpm workspace resolution
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY config/ ./config/

COPY packages/video-worker/package.json ./packages/video-worker/
RUN pnpm --filter video-worker install --frozen-lockfile

COPY packages/video-worker/ ./packages/video-worker/

WORKDIR /app/packages/video-worker

ENV NODE_ENV=production
# Tell Remotion/Puppeteer to use the system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

ENTRYPOINT ["pnpm", "exec", "tsx", "src/entrypoints/docker.ts"]
