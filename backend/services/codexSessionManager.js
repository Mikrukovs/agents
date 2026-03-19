const crypto = require('crypto');

let codexClassPromise = null;

async function getCodexClass() {
  if (!codexClassPromise) {
    codexClassPromise = import('@openai/codex-sdk').then((m) => m.Codex);
  }
  return codexClassPromise;
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
    return {
      itemId: String(item.id || item.uuid || item.type || 'agent-message'),
      text: normalizeText(item.text || item.content || '')
    };
  }

  return { itemId: null, text: '' };
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

class CodexSessionManager {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
  }

  createThreadOptions(model) {
    return {
      workingDirectory: this.config.workdir,
      skipGitRepoCheck: true,
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
      model: model || this.config.defaultModel
    };
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  requireSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      const error = new Error('Session not found');
      error.status = 404;
      throw error;
    }
    return session;
  }

  async createSession(model) {
    const Codex = await getCodexClass();
    const codex = new Codex();
    const thread = codex.startThread(this.createThreadOptions(model));
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

    this.sessions.set(sessionId, session);
    return session;
  }

  addClient(sessionId, res) {
    const session = this.requireSession(sessionId);
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

    return () => {
      clearInterval(heartbeat);
      session.clients.delete(res);
    };
  }

  broadcast(session, payload) {
    session.clients.forEach((client) => {
      try {
        sendSse(client, payload);
      } catch (_err) {
        // Ignore broken stream; cleanup happens on close.
      }
    });
  }

  async runTurn(sessionId, message) {
    const session = this.requireSession(sessionId);
    if (session.running) {
      const error = new Error('Session is already running');
      error.status = 409;
      throw error;
    }

    session.running = true;
    session.abortController = new AbortController();
    session.lastActivityAt = new Date().toISOString();

    const timeoutHandle = setTimeout(() => {
      try {
        session.abortController?.abort();
      } catch (_err) {
        // noop
      }
    }, this.config.turnTimeoutMs);

    const itemTextById = new Map();
    this.broadcast(session, { type: 'turn_started', sessionId: session.id });

    try {
      const streamedTurn = await session.thread.runStreamed(message, {
        signal: session.abortController.signal
      });

      for await (const event of streamedTurn.events) {
        if (!this.sessions.has(session.id)) {
          break;
        }

        if (event.type === 'item.started' || event.type === 'item.updated' || event.type === 'item.completed') {
          const { itemId, text } = extractItemText(event);
          if (itemId) {
            const prev = itemTextById.get(itemId) || '';
            const delta = text.startsWith(prev) ? text.slice(prev.length) : text;
            itemTextById.set(itemId, text);
            if (delta) {
              this.broadcast(session, {
                type: 'assistant_text_delta',
                sessionId: session.id,
                delta
              });
            }
          }
        }

        if (event.type === 'turn.failed') {
          this.broadcast(session, {
            type: 'error',
            sessionId: session.id,
            error: event?.error?.message || 'Codex turn failed'
          });
        }
      }

      this.broadcast(session, { type: 'turn_complete', sessionId: session.id });
    } catch (error) {
      const isAborted = error?.name === 'AbortError';
      this.broadcast(session, {
        type: isAborted ? 'turn_aborted' : 'error',
        sessionId: session.id,
        error: isAborted
          ? `Codex request timed out after ${this.config.turnTimeoutMs / 1000}s`
          : (error?.message || 'Codex request failed')
      });
    } finally {
      clearTimeout(timeoutHandle);
      session.running = false;
      session.abortController = null;
      session.lastActivityAt = new Date().toISOString();
    }
  }

  abortSession(sessionId) {
    const session = this.requireSession(sessionId);
    session.abortController?.abort();
    return session;
  }

  closeSession(sessionId) {
    const session = this.requireSession(sessionId);
    session.abortController?.abort();

    this.broadcast(session, { type: 'session_closed', sessionId: session.id });
    session.clients.forEach((client) => {
      try {
        client.end();
      } catch (_err) {
        // noop
      }
    });

    this.sessions.delete(session.id);
    return session;
  }
}

module.exports = { CodexSessionManager };
