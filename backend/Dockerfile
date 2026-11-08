# Picasso API: FastAPI + the Claude Agent SDK (its bundled Claude Code binary) + ffmpeg.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy \
    PICASSO_DATA_DIR=/data

# ffmpeg from Debian (with libfreetype for captions); fonts ship in app/fonts.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY scripts ./scripts

# Run unprivileged; /data is the persistent volume (database, uploads, renders, per-user Claude dirs).
RUN useradd --create-home --uid 10001 picasso && mkdir -p /data && chown picasso /data
USER picasso
ENV PATH="/app/.venv/bin:$PATH" PICASSO_FFMPEG=/usr/bin/ffmpeg
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
