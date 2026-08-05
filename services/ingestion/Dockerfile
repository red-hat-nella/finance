FROM registry.access.redhat.com/ubi9/nodejs-22@sha256:03d4c3669c9ada46d60e6c6ab5f1a305005d9ebe33f6dba0a24cb7b172ff75a3 AS build
WORKDIR /opt/app-root/src
COPY --chown=1001:0 services/ingestion/package.json services/ingestion/package-lock.json ./
RUN npm ci
COPY --chown=1001:0 services/ingestion/tsconfig.json services/ingestion/tsconfig.build.json ./
COPY --chown=1001:0 services/ingestion/src ./src
RUN npm run build && npm prune --omit=dev

FROM registry.access.redhat.com/ubi9/nodejs-22@sha256:03d4c3669c9ada46d60e6c6ab5f1a305005d9ebe33f6dba0a24cb7b172ff75a3
WORKDIR /opt/app-root/src
COPY --from=build --chown=1001:0 /opt/app-root/src/dist ./dist
COPY --from=build --chown=1001:0 /opt/app-root/src/node_modules ./node_modules
COPY --from=build --chown=1001:0 /opt/app-root/src/package.json ./package.json
COPY --chown=1001:0 db/migrations ./migrations
RUN chmod -R g=u /opt/app-root/src
USER 1001
EXPOSE 8080
CMD ["node","dist/server.js"]
