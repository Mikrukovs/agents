const express = require('express');
const { checkCodexAuthStatus } = require('../services/codexAuth');

function createCodexRouter(sessionManager) {
  const router = express.Router();

  router.get('/auth/status', async (_req, res) => {
    const status = await checkCodexAuthStatus();
    res.json(status);
  });

  router.post('/sessions', async (req, res) => {
    try {
      const model = typeof req.body?.model === 'string' ? req.body.model : undefined;
      const session = await sessionManager.createSession(model);
      res.json({
        ok: true,
        sessionId: session.id,
        status: {
          running: session.running,
          createdAt: session.createdAt
        }
      });
    } catch (error) {
      console.error('Failed to create Codex session', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to create Codex session',
        details: error?.message || 'Unknown error'
      });
    }
  });

  router.get('/sessions/:sessionId/events', (req, res) => {
    try {
      const sessionId = req.params.sessionId;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const cleanup = sessionManager.addClient(sessionId, res);
      req.on('close', cleanup);
    } catch (error) {
      const status = error?.status || 500;
      res.status(status).json({ ok: false, error: error.message || 'Failed to open event stream' });
    }
  });

  router.post('/sessions/:sessionId/messages', async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!message) {
        res.status(400).json({ ok: false, error: 'Field "message" is required' });
        return;
      }

      sessionManager.runTurn(sessionId, message).catch((error) => {
        console.error('Unexpected codex turn error', error);
      });

      res.json({ ok: true, accepted: true, sessionId });
    } catch (error) {
      const status = error?.status || 500;
      res.status(status).json({ ok: false, error: error.message || 'Failed to start turn' });
    }
  });

  router.post('/sessions/:sessionId/abort', (req, res) => {
    try {
      sessionManager.abortSession(req.params.sessionId);
      res.json({ ok: true });
    } catch (error) {
      const status = error?.status || 500;
      res.status(status).json({ ok: false, error: error.message || 'Failed to abort session' });
    }
  });

  router.delete('/sessions/:sessionId', (req, res) => {
    try {
      sessionManager.closeSession(req.params.sessionId);
      res.json({ ok: true });
    } catch (error) {
      const status = error?.status || 500;
      res.status(status).json({ ok: false, error: error.message || 'Failed to close session' });
    }
  });

  return router;
}

module.exports = { createCodexRouter };
