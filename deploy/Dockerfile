FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY ../package.json package-lock.json* ./
RUN npm install --omit=dev

RUN npm install -g @openai/codex
RUN npm install -g @anthropic-ai/claude-code

COPY .. .

# Demo-only: bake Codex auth into the image from build context.
RUN mkdir -p /root/.codex
COPY ../.secrets/codex/auth.json /root/.codex/auth.json
RUN chmod 600 /root/.codex/auth.json

ENV PORT=3000
ENV CODEX_WORKDIR=/app
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt

EXPOSE 3000

CMD ["node", "server.js"]
