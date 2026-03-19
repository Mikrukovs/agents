const path = require('path');

function getConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    staticDir: path.resolve(__dirname, '..'),
    codexServiceUrl: process.env.CODEX_SERVICE_URL || 'http://codex-provider:3101',
    claudeServiceUrl: process.env.CLAUDE_SERVICE_URL || 'http://claude-provider:3102'
  };
}

module.exports = { getConfig };
