import { describe, expect, it, vi } from 'vitest';
import { refreshBloggerAccessToken } from '../../tools/google-access-token.js';

describe('Google OAuth token refresh', () => {
  it('posts the refresh grant, masks the token, then exports it', async () => {
    const events: string[] = [];
    const fetcher = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('client_id')).toBe('client');
      expect(body.get('client_secret')).toBe('secret');
      expect(body.get('refresh_token')).toBe('refresh');
      return new Response(JSON.stringify({ access_token: 'access', token_type: 'Bearer', expires_in: 3600 }), { status: 200 });
    });
    const append = vi.fn(async (_path, value) => { events.push(`append:${String(value)}`); });

    await refreshBloggerAccessToken({
      clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh', githubEnv: '/tmp/env',
      fetcher, append, log: (message) => { events.push(`log:${message}`); }
    });

    expect(events[0]).toBe('log:::add-mask::access');
    expect(events[1]).toBe('append:BLOGGER_ACCESS_TOKEN=access\n');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('rejects malformed success responses without exporting a token', async () => {
    const append = vi.fn(async () => undefined);
    await expect(refreshBloggerAccessToken({
      clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh', githubEnv: '/tmp/env',
      fetcher: async () => new Response(JSON.stringify({ access_token: 'access', token_type: 'Basic', expires_in: 3600 })),
      append, log: vi.fn()
    })).rejects.toThrow('Bearer token_type');
    expect(append).not.toHaveBeenCalled();
  });

  it('maps invalid_grant to safe remediation without leaking credentials', async () => {
    await expect(refreshBloggerAccessToken({
      clientId: 'client', clientSecret: 'top-secret', refreshToken: 'refresh-secret', githubEnv: '/tmp/env',
      fetcher: async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
      append: vi.fn(), log: vi.fn()
    })).rejects.toThrow('expired, revoked');
  });
});
