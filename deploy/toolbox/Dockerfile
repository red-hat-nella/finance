ARG CLI_IMAGE=quay.io/openshift/origin-cli@sha256:4c1b64a79727e392c11cf337936f9edb792e436075d4bdad5f554b79652d16dd
ARG NODE_IMAGE=registry.access.redhat.com/ubi9/nodejs-22@sha256:03d4c3669c9ada46d60e6c6ab5f1a305005d9ebe33f6dba0a24cb7b172ff75a3
FROM ${CLI_IMAGE} AS cli
FROM ${NODE_IMAGE}
USER 0
RUN dnf install -y git jq python3.12 python3.12-pip findutils tar gzip \
    && dnf clean all \
    && python3.12 -m pip install --no-cache-dir uv==0.12.0
COPY --from=cli /usr/bin/oc /usr/local/bin/oc
RUN chmod 0755 /usr/local/bin/oc && chmod -R g=u /opt/app-root
USER 1001
WORKDIR /workspace
CMD ["bash"]
