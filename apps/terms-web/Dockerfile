FROM registry.access.redhat.com/ubi9/nodejs-22@sha256:03d4c3669c9ada46d60e6c6ab5f1a305005d9ebe33f6dba0a24cb7b172ff75a3 AS build
WORKDIR /opt/app-root/src
COPY --chown=1001:0 package.json package-lock.json ./
COPY --chown=1001:0 packages/ui-foundation/package.json packages/ui-foundation/package.json
COPY --chown=1001:0 packages/ui-foundation/src packages/ui-foundation/src
COPY --chown=1001:0 apps/terms-web/package.json apps/terms-web/package.json
RUN npm ci --workspace apps/terms-web --include-workspace-root=false
WORKDIR /opt/app-root/src/apps/terms-web
COPY --chown=1001:0 apps/terms-web/ .
RUN npm run build -- --configuration production

FROM registry.access.redhat.com/ubi9/nginx-124@sha256:46ddcae20e61335ee5224c354721018b7cd9b35d5c505d9ba768d9b60569c48a
COPY --from=build --chown=1001:0 /opt/app-root/src/apps/terms-web/dist/terms-web/browser /opt/app-root/src
COPY --chown=1001:0 apps/terms-web/nginx.conf /etc/nginx/nginx.conf
USER 0
RUN mkdir -p /opt/app-root/runtime-config \
    && chmod -R g=u /opt/app-root/src /opt/app-root/runtime-config /etc/nginx/nginx.conf
USER 1001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -fsS http://127.0.0.1:8080/health/live || exit 1
CMD ["nginx", "-g", "daemon off;"]
