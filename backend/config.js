const path = require('path');

function getConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    workdir: process.env.CODEX_WORKDIR || '/app',
    defaultModel: process.env.CODEX_MODEL || undefined,
    turnTimeoutMs: Number(process.env.CODEX_TURN_TIMEOUT_MS || 90000),
    staticDir: path.resolve(__dirname, '..')
  };
}

module.exports = { getConfig };
