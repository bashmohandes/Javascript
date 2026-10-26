FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797
ARG BUILD_VERSION=dev
ARG BUILD_CHANNEL=dev
ENV NODE_ENV=production PORT=8080
ENV BUILD_VERSION=${BUILD_VERSION}
ENV BUILD_CHANNEL=${BUILD_CHANNEL}
LABEL org.opencontainers.image.version=${BUILD_VERSION}
LABEL org.opencontainers.image.release-channel=${BUILD_CHANNEL}
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN apk add --no-cache --upgrade libcrypto3=3.5.9-r0 libssl3=3.5.9-r0 \
    && node scripts/generate-icons.js \
    && mkdir -p /app/data \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && chown -R node:node /app
USER node
VOLUME ["/app/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
CMD ["node", "server/index.js"]
