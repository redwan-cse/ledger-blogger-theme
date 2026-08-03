interface TokenResponse { access_token?: unknown; expires_in?: unknown; token_type?: unknown; scope?: unknown; error?: unknown; error_description?: unknown }
function required(name: 'GOOGLE_OAUTH_CLIENT_ID' | 'GOOGLE_OAUTH_CLIENT_SECRET' | 'BLOGGER_REFRESH_TOKEN'): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required.`); return value; }
const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: required('GOOGLE_OAUTH_CLIENT_ID'), client_secret: required('GOOGLE_OAUTH_CLIENT_SECRET'), refresh_token: required('BLOGGER_REFRESH_TOKEN'), grant_type: 'refresh_token' }), signal: AbortSignal.timeout(30_000) });
let payload: TokenResponse;
try { payload = await response.json() as TokenResponse; } catch { throw new Error(`Google OAuth refresh returned non-JSON HTTP ${response.status}.`); }
if (!response.ok) { const error = typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`; const help = error === 'invalid_grant' ? ' Refresh token is expired, revoked, belongs to another OAuth client, or the app is still subject to testing-token expiry.' : ''; throw new Error(`Google OAuth refresh failed: ${error}.${help}`); }
if (typeof payload.access_token !== 'string' || !payload.access_token) throw new Error('Google OAuth response omitted access_token.');
if (payload.token_type !== 'Bearer') throw new Error('Google OAuth response did not return Bearer token_type.');
if (typeof payload.expires_in !== 'number' || payload.expires_in <= 0) throw new Error('Google OAuth response has invalid expires_in.');
console.log(`::add-mask::${payload.access_token}`);
const githubEnv = process.env.GITHUB_ENV; if (!githubEnv) throw new Error('GITHUB_ENV is required.');
const { appendFile } = await import('node:fs/promises'); await appendFile(githubEnv, `BLOGGER_ACCESS_TOKEN=${payload.access_token}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(`Google OAuth access token refreshed; expires in ${payload.expires_in} seconds.`);
