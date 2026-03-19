const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const WORKDIR = process.env.CODEX_WORKDIR || '/app';
const DEFAULT_MODEL = process.env.CODEX_MODEL || undefined;

const sessions = new Map();
let codexClassPromise = null;

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

async function getCodexClass() {
  if (!codexClassPromise) {
    codexClassPromise = import('@openai/codex-sdk').then((m) => m.Codex);
  }
  return codexClassPromise;
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(session, payload) {
  session.clients.forEach((client) => {
    try {
      sendSse(client, payload);
    } catch (_err) {
      // Ignore broken stream; cleanup happens on close.
    }
  });
}

function createThreadOptions(model) {
  return {
    workingDirectory: WORKDIR,
    skipGitRepoCheck: true,
    sandboxMode: 'workspace-write',
    approvalPolicy: 'never',
    model: model || DEFAULT_MODEL
  };
}

function normalizeText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  return '';
}

function extractItemText(event) {
  const item = event?.item;
  if (!item) return { itemId: null, text: '' };

  if (item.type === 'agent_message' || item.type === 'reasoning') {
    const text = normalizeText(item.text || item.content || '');
    const itemId = String(item.id || item.uuid || item.type || 'agent-message');
    return { itemId, text };
  }

  return { itemId: null, text: '' };
}

async function runCodexTurn(session, message) {
  session.running = true;
  session.abortController = new AbortController();
  session.lastActivityAt = new Date().toISOString();
  const turnTimeoutMs = Number(process.env.CODEX_TURN_TIMEOUT_MS || 90000);
  const timeoutHandle = setTimeout(() => {
    try {
      session.abortController?.abort();
    } catch (_err) {
      // noop
    }
  }, turnTimeoutMs);

  const itemTextById = new Map();
  broadcast(session, { type: 'turn_started', sessionId: session.id });

  try {
    const streamedTurn = await session.thread.runStreamed(message, {
      signal: session.abortController.signal
    });

    for await (const event of streamedTurn.events) {
      if (!sessions.has(session.id)) {
        break;
      }

      if (event.type === 'item.started' || event.type === 'item.updated' || event.type === 'item.completed') {
        const { itemId, text } = extractItemText(event);
        if (itemId) {
          const prev = itemTextById.get(itemId) || '';
          const delta = text.startsWith(prev) ? text.slice(prev.length) : text;
          itemTextById.set(itemId, text);

          if (delta) {
            broadcast(session, {
              type: 'assistant_text_delta',
              sessionId: session.id,
              delta
            });
          }
        }
      }

      if (event.type === 'turn.failed') {
        const messageText = event?.error?.message || 'Codex turn failed';
        broadcast(session, { type: 'error', sessionId: session.id, error: messageText });
      }
    }

    broadcast(session, { type: 'turn_complete', sessionId: session.id });
  } catch (error) {
    const isAborted = error?.name === 'AbortError';
    broadcast(session, {
      type: isAborted ? 'turn_aborted' : 'error',
      sessionId: session.id,
      error: isAborted
        ? `Codex request timed out after ${turnTimeoutMs / 1000}s`
        : (error?.message || 'Codex request failed')
    });
  } finally {
    clearTimeout(timeoutHandle);
    session.running = false;
    session.abortController = null;
    session.lastActivityAt = new Date().toISOString();
  }
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.resolve(__dirname)));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/codex/auth/status', async (_req, res) => {
  try {
    const authPath = path.join(os.homedir(), '.codex', 'auth.json');
    const content = await fs.readFile(authPath, 'utf8');
    const auth = JSON.parse(content);
    const tokens = auth?.tokens || {};

    res.json({
      ok: true,
      authenticated: Boolean(tokens.id_token || tokens.access_token || auth.OPENAI_API_KEY)
    });
  } catch (_error) {
    res.json({ ok: true, authenticated: false });
  }
});

app.post('/api/codex/sessions', async (req, res) => {
  try {
    const model = typeof req.body?.model === 'string' ? req.body.model : undefined;

    const Codex = await getCodexClass();
    const codex = new Codex();
    const thread = codex.startThread(createThreadOptions(model));
    const sessionId = String(thread.id || crypto.randomUUID());

    const session = {
      id: sessionId,
      codex,
      thread,
      running: false,
      clients: new Set(),
      abortController: null,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    sessions.set(sessionId, session);

    res.json({
      ok: true,
      sessionId,
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

app.get('/api/codex/sessions/:sessionId/events', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ ok: false, error: 'Session not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  session.clients.add(res);
  sendSse(res, {
    type: 'session_ready',
    sessionId: session.id,
    running: session.running,
    createdAt: session.createdAt
  });

  const heartbeat = setInterval(() => {
    sendSse(res, { type: 'heartbeat', ts: Date.now() });
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    session.clients.delete(res);
  });
});

app.post('/api/codex/sessions/:sessionId/messages', async (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ ok: false, error: 'Session not found' });
    return;
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    res.status(400).json({ ok: false, error: 'Field "message" is required' });
    return;
  }

  if (session.running) {
    res.status(409).json({ ok: false, error: 'Session is already running' });
    return;
  }

  runCodexTurn(session, message).catch((error) => {
    console.error('Unexpected codex turn error', error);
  });

  res.json({ ok: true, accepted: true, sessionId: session.id });
});

app.post('/api/codex/sessions/:sessionId/abort', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ ok: false, error: 'Session not found' });
    return;
  }

  if (session.abortController) {
    session.abortController.abort();
  }

  res.json({ ok: true });
});

app.delete('/api/codex/sessions/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ ok: false, error: 'Session not found' });
    return;
  }

  if (session.abortController) {
    session.abortController.abort();
  }

  broadcast(session, { type: 'session_closed', sessionId: session.id });
  session.clients.forEach((client) => {
    try {
      client.end();
    } catch (_err) {
      // noop
    }
  });

  sessions.delete(session.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
