const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function checkCodexAuthStatus() {
  try {
    const authPath = path.join(os.homedir(), '.codex', 'auth.json');
    const content = await fs.readFile(authPath, 'utf8');
    const auth = JSON.parse(content);
    const tokens = auth?.tokens || {};

    return {
      ok: true,
      authenticated: Boolean(tokens.id_token || tokens.access_token || auth.OPENAI_API_KEY)
    };
  } catch (_error) {
    return { ok: true, authenticated: false };
  }
}

module.exports = { checkCodexAuthStatus };
