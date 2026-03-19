const crypto = require('crypto');

let claudeQueryPromise = null;

async function getClaudeQueryFn() {
  if (!claudeQueryPromise) {
    claudeQueryPromise = import('@anthropic-ai/claude-agent-sdk').then((m) => m.query);
  }
  return claudeQueryPromise;
}

function sendSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function extractTextFromArray(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part?.type === 'text' && typeof part.text === 'string') return part.text;
      if (typeof part?.text === 'string') return part.text;
      return '';
    })
    .join('');
}

class ClaudeSessionManager {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
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

  createSession(model) {
    const sessionId = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

    const session = {
      id: sessionId,
      providerSessionId: null,
      model: model || this.config.defaultClaudeModel,
      running: false,
      clients: new Set(),
      instance: null,
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
        // Ignore broken stream.
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

    const query = await getClaudeQueryFn();

    session.running = true;
    session.lastActivityAt = new Date().toISOString();
    this.broadcast(session, { type: 'turn_started', sessionId: session.id });

    const options = {
      cwd: this.config.workdir,
      model: session.model
    };
    if (session.providerSessionId) {
      options.resume = session.providerSessionId;
    }

    let timeoutHit = false;
    const timeoutHandle = setTimeout(async () => {
      timeoutHit = true;
      try {
        await session.instance?.interrupt?.();
      } catch (_err) {
        // noop
      }
    }, this.config.turnTimeoutMs);

    try {
      const instance = query({ prompt: message, options });
      session.instance = instance;

      for await (const event of instance) {
        if (!this.sessions.has(session.id)) {
          break;
        }

        if (event?.session_id && !session.providerSessionId) {
          session.providerSessionId = event.session_id;
        }

        if (event?.type === 'content_block_delta' && event?.delta?.text) {
          this.broadcast(session, {
            type: 'assistant_text_delta',
            sessionId: session.id,
            delta: event.delta.text
          });
          continue;
        }

        if (event?.type === 'assistant') {
          const text = extractTextFromArray(event.message?.content);
          if (text) {
            this.broadcast(session, {
              type: 'assistant_text_delta',
              sessionId: session.id,
              delta: text
            });
          }
          continue;
        }

        if (event?.type === 'result' && event?.result === 'error') {
          this.broadcast(session, {
            type: 'error',
            sessionId: session.id,
            error: event?.error || 'Claude turn failed'
          });
        }
      }

      if (timeoutHit) {
        this.broadcast(session, {
          type: 'turn_aborted',
          sessionId: session.id,
          error: `Claude request timed out after ${this.config.turnTimeoutMs / 1000}s`
        });
      } else {
        this.broadcast(session, { type: 'turn_complete', sessionId: session.id });
      }
    } catch (error) {
      const isInterrupt = /interrupt|cancel|aborted/i.test(String(error?.message || ''));
      this.broadcast(session, {
        type: isInterrupt ? 'turn_aborted' : 'error',
        sessionId: session.id,
        error: isInterrupt
          ? 'Claude request interrupted'
          : (error?.message || 'Claude request failed')
      });
    } finally {
      clearTimeout(timeoutHandle);
      session.running = false;
      session.instance = null;
      session.lastActivityAt = new Date().toISOString();
    }
  }

  async abortSession(sessionId) {
    const session = this.requireSession(sessionId);
    try {
      await session.instance?.interrupt?.();
    } catch (_err) {
      // noop
    }
    return session;
  }

  async closeSession(sessionId) {
    const session = this.requireSession(sessionId);
    try {
      await session.instance?.interrupt?.();
    } catch (_err) {
      // noop
    }

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

module.exports = { ClaudeSessionManager };
