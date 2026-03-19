const express = require('express');
const { corsMiddleware } = require('./middleware/cors');
const { createHealthRouter } = require('./routes/health');
const { createProviderProxyRouter } = require('./routes/providerProxy');

function createApp(config) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(config.staticDir));
  app.use(corsMiddleware);

  app.use(createHealthRouter());
  app.use(createProviderProxyRouter(config));

  return app;
}

module.exports = { createApp };
