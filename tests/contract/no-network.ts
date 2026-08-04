import { afterAll, beforeAll, vi } from 'vitest';

const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = vi.fn(async () => {
    throw new Error('Contract tests are offline; network access is forbidden.');
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});
