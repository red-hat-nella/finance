FROM registry.access.redhat.com/ubi9/nodejs-22@sha256:03d4c3669c9ada46d60e6c6ab5f1a305005d9ebe33f6dba0a24cb7b172ff75a3 AS build

WORKDIR /opt/app-root/src
COPY --chown=1001:0 package.json package-lock.json ./
COPY --chown=1001:0 services/terms-api/package.json services/terms-api/package.json
RUN npm ci --workspace services/terms-api --include-workspace-root=false
COPY --chown=1001:0 services/terms-api/tsconfig.json services/terms-api/tsconfig.build.json services/terms-api/
COPY --chown=1001:0 services/terms-api/src services/terms-api/src
RUN npm run --workspace services/terms-api build \
  && npm prune --omit=dev

FROM registry.access.redhat.com/ubi9/nodejs-22@sha256:03d4c3669c9ada46d60e6c6ab5f1a305005d9ebe33f6dba0a24cb7b172ff75a3

ENV HOME=/tmp \
    NODE_ENV=production \
    PORT=8080
WORKDIR /opt/app-root/src
COPY --from=build --chown=1001:0 /opt/app-root/src/node_modules ./node_modules
COPY --from=build --chown=1001:0 /opt/app-root/src/services/terms-api/dist ./services/terms-api/dist
COPY --from=build --chown=1001:0 /opt/app-root/src/services/terms-api/package.json ./services/terms-api/package.json
COPY --chown=1001:0 db/terms-migrations ./migrations
RUN chmod -R g=u /opt/app-root/src

# OpenShift may replace 1001 with any non-root UID in group 0. The process writes only
# to externally supplied tmpfs mounts (for example /tmp), so the root filesystem can
# be mounted read-only.
USER 1001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -fsS http://127.0.0.1:8080/health/live || exit 1
CMD ["node", "services/terms-api/dist/server.js"]
