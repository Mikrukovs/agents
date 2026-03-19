const express = require('express');
const { corsMiddleware } = require('./middleware/cors');
const { createHealthRouter } = require('./routes/health');
const { createCodexRouter } = require('./routes/codex');
const { CodexSessionManager } = require('./services/codexSessionManager');

function createApp(config) {
  const app = express();
  const sessionManager = new CodexSessionManager(config);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(config.staticDir));
  app.use(corsMiddleware);

  app.use(createHealthRouter());
  app.use('/api/codex', createCodexRouter(sessionManager));

  return app;
}

module.exports = { createApp };
