const express = require('express');
const { Readable } = require('stream');

function buildTargetUrl(baseUrl, requestUrl) {
  return `${baseUrl.replace(/\/$/, '')}${requestUrl}`;
}

async function proxyRequest(req, res, targetBaseUrl) {
  const targetUrl = buildTargetUrl(targetBaseUrl, req.url);

  const headers = {};
  if (req.headers['content-type']) {
    headers['content-type'] = req.headers['content-type'];
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? JSON.stringify(req.body || {}) : undefined
  });

  const contentType = upstream.headers.get('content-type') || '';
  const isEventStream = contentType.includes('text/event-stream');

  res.status(upstream.status);
  if (contentType) {
    res.setHeader('content-type', contentType);
  }

  if (isEventStream && upstream.body) {
    const nodeStream = Readable.fromWeb(upstream.body);
    req.on('close', () => {
      try {
        nodeStream.destroy();
      } catch (_err) {
        // noop
      }
    });
    nodeStream.pipe(res);
    return;
  }

  const text = await upstream.text();
  res.send(text);
}

function createProviderProxyRouter(config) {
  const router = express.Router();

  router.use('/api/codex', async (req, res) => {
    try {
      await proxyRequest(req, res, config.codexServiceUrl);
    } catch (error) {
      res.status(502).json({ ok: false, error: `Codex provider unavailable: ${error.message}` });
    }
  });

  router.use('/api/claude', async (req, res) => {
    try {
      await proxyRequest(req, res, config.claudeServiceUrl);
    } catch (error) {
      res.status(502).json({ ok: false, error: `Claude provider unavailable: ${error.message}` });
    }
  });

  return router;
}

module.exports = { createProviderProxyRouter };
