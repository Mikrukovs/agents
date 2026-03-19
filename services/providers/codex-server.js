const express = require('express');
const { corsMiddleware } = require('../../backend/middleware/cors');
const { createCodexRouter } = require('../../backend/routes/codex');
const { CodexSessionManager } = require('../../backend/services/codexSessionManager');

const app = express();
const port = Number(process.env.PORT || 3101);

const sessionManager = new CodexSessionManager({
  workdir: process.env.CODEX_WORKDIR || '/workspace',
  defaultModel: process.env.CODEX_MODEL || undefined,
  turnTimeoutMs: Number(process.env.CODEX_TURN_TIMEOUT_MS || 90000)
});

app.use(express.json({ limit: '1mb' }));
app.use(corsMiddleware);
app.get('/health', (_req, res) => res.json({ ok: true, provider: 'codex' }));
app.use('/', createCodexRouter(sessionManager));

app.listen(port, () => {
  console.log(`Codex provider listening on http://0.0.0.0:${port}`);
});
