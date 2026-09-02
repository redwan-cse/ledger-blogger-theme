import { appendFile } from 'node:fs/promises';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

interface TokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  error?: unknown;
}

export interface RefreshTokenOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  githubEnv: string;
  fetcher?: typeof fetch;
  append?: typeof appendFile;
  log?: (message: string) => void;
}

export async function refreshBloggerAccessToken(options: RefreshTokenOptions): Promise<void> {
  const fetcher = options.fetcher ?? fetch;
  const append = options.append ?? appendFile;
  const log = options.log ?? console.log;
  const response = await fetcher(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: options.clientId,
      client_secret: options.clientSecret,
      refresh_token: options.refreshToken,
      grant_type: 'refresh_token'
    }),
    signal: AbortSignal.timeout(30_000)
  });

  let payload: TokenResponse;
  try { payload = await response.json() as TokenResponse; }
  catch { throw new Error(`Google OAuth refresh returned non-JSON HTTP ${response.status}.`); }

  if (!response.ok) {
    const error = typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`;
    const help = error === 'invalid_grant'
      ? ' Refresh token is expired, revoked, belongs to another OAuth client, or the app is still subject to testing-token expiry.'
      : '';
    throw new Error(`Google OAuth refresh failed: ${error}.${help}`);
  }
  if (typeof payload.access_token !== 'string' || !payload.access_token) throw new Error('Google OAuth response omitted access_token.');
  if (!/^[a-zA-Z0-9._~+/=-]+$/.test(payload.access_token)) throw new Error('Google OAuth response returned invalid characters in access_token.');
  if (payload.token_type !== 'Bearer') throw new Error('Google OAuth response did not return Bearer token_type.');
  if (typeof payload.expires_in !== 'number' || payload.expires_in <= 0) throw new Error('Google OAuth response has invalid expires_in.');

  log(`::add-mask::${payload.access_token}`);
  await append(options.githubEnv, `BLOGGER_ACCESS_TOKEN=${payload.access_token}\n`, { encoding: 'utf8', mode: 0o600 });
  log(`Google OAuth access token refreshed; expires in ${payload.expires_in} seconds.`);
}

function required(name: 'GOOGLE_OAUTH_CLIENT_ID' | 'GOOGLE_OAUTH_CLIENT_SECRET' | 'BLOGGER_REFRESH_TOKEN' | 'GITHUB_ENV'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await refreshBloggerAccessToken({
    clientId: required('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: required('GOOGLE_OAUTH_CLIENT_SECRET'),
    refreshToken: required('BLOGGER_REFRESH_TOKEN'),
    githubEnv: required('GITHUB_ENV')
  });
}
