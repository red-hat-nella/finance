FROM registry.access.redhat.com/ubi9/python-312@sha256:e7d8c7e8f74e7fb8a8599e15c4eef37984e0919c7afe335a31b12a39e98e6b9a
WORKDIR /opt/app-root/src
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/app-root/src/.venv/bin:${PATH}"
COPY --chown=1001:0 pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv==0.12.0 \
    && uv sync --frozen --no-dev --no-install-project
COPY --chown=1001:0 app ./app
RUN chmod -R g=u /opt/app-root/src
USER 1001
EXPOSE 8080
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080","--no-access-log"]
