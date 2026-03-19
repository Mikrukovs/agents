const fs = require('fs/promises');
const path = require('path');
const os = require('os');

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

async function checkClaudeAuthStatus() {
  if (typeof process.env.ANTHROPIC_API_KEY === 'string' && process.env.ANTHROPIC_API_KEY.trim()) {
    return { ok: true, authenticated: true, method: 'env_api_key' };
  }

  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const settings = await readJsonSafe(settingsPath);
  const settingsEnv = settings?.env || {};
  if (typeof settingsEnv.ANTHROPIC_API_KEY === 'string' && settingsEnv.ANTHROPIC_API_KEY.trim()) {
    return { ok: true, authenticated: true, method: 'settings_api_key' };
  }

  const credentialsPath = path.join(os.homedir(), '.claude', '.credentials.json');
  const credentials = await readJsonSafe(credentialsPath);
  const oauth = credentials?.claudeAiOauth;
  if (oauth?.accessToken) {
    const isExpired = oauth.expiresAt && Date.now() >= Number(oauth.expiresAt);
    if (!isExpired) {
      return { ok: true, authenticated: true, method: 'oauth_credentials' };
    }
  }

  return { ok: true, authenticated: false, method: null };
}

module.exports = { checkClaudeAuthStatus };
