interface TokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
}

function required(name: 'GOOGLE_OAUTH_CLIENT_ID' | 'GOOGLE_OAUTH_CLIENT_SECRET' | 'BLOGGER_REFRESH_TOKEN'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const body = new URLSearchParams({
  client_id: required('GOOGLE_OAUTH_CLIENT_ID'),
  client_secret: required('GOOGLE_OAUTH_CLIENT_SECRET'),
  refresh_token: required('BLOGGER_REFRESH_TOKEN'),
  grant_type: 'refresh_token'
});

const response = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body,
  signal: AbortSignal.timeout(30_000)
});
const payload = await response.json() as TokenResponse;
if (!response.ok || typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
  const reason = typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
  throw new Error(`Google OAuth refresh failed: ${reason}.`);
}

const githubEnv = process.env.GITHUB_ENV;
if (!githubEnv) throw new Error('GITHUB_ENV is required; this command is only for GitHub Actions.');
console.log(`::add-mask::${payload.access_token}`);
const { appendFile } = await import('node:fs/promises');
await appendFile(githubEnv, `BLOGGER_ACCESS_TOKEN=${payload.access_token}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(`Google OAuth access token refreshed; expires in ${typeof payload.expires_in === 'number' ? payload.expires_in : 'unknown'} seconds.`);
