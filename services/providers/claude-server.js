const express = require('express');
const { corsMiddleware } = require('../../backend/middleware/cors');
const { createClaudeRouter } = require('../../backend/routes/claude');
const { ClaudeSessionManager } = require('../../backend/services/claudeSessionManager');

const app = express();
const port = Number(process.env.PORT || 3102);

const sessionManager = new ClaudeSessionManager({
  workdir: process.env.CLAUDE_WORKDIR || '/workspace',
  defaultClaudeModel: process.env.CLAUDE_MODEL || 'sonnet',
  turnTimeoutMs: Number(process.env.CLAUDE_TURN_TIMEOUT_MS || 90000)
});

app.use(express.json({ limit: '1mb' }));
app.use(corsMiddleware);
app.get('/health', (_req, res) => res.json({ ok: true, provider: 'claude' }));
app.use('/', createClaudeRouter(sessionManager));

app.listen(port, () => {
  console.log(`Claude provider listening on http://0.0.0.0:${port}`);
});
