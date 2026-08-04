FROM registry.access.redhat.com/ubi9/nodejs-22@sha256:03d4c3669c9ada46d60e6c6ab5f1a305005d9ebe33f6dba0a24cb7b172ff75a3 AS build
WORKDIR /opt/app-root/src
COPY --chown=1001:0 package.json package-lock.json ./
RUN npm ci
COPY --chown=1001:0 . .
RUN npm run build -- --configuration production

FROM registry.access.redhat.com/ubi9/nginx-124@sha256:46ddcae20e61335ee5224c354721018b7cd9b35d5c505d9ba768d9b60569c48a
COPY --from=build --chown=1001:0 /opt/app-root/src/dist/frontend/browser /opt/app-root/src
COPY --chown=1001:0 nginx.conf /etc/nginx/nginx.conf
COPY --chown=1001:0 container-entrypoint.sh /opt/app-root/bin/container-entrypoint.sh
COPY --chown=1001:0 scripts/render-runtime-config.sh /opt/app-root/bin/render-runtime-config.sh
USER 0
RUN mkdir -p /opt/app-root/runtime-config \
    && chmod -R g=u /opt/app-root/src /opt/app-root/runtime-config \
    && chmod 0555 /opt/app-root/bin/container-entrypoint.sh /opt/app-root/bin/render-runtime-config.sh
USER 1001
EXPOSE 8080
CMD ["/opt/app-root/bin/container-entrypoint.sh"]
