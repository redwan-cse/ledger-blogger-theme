export const MINIMUM_PACE_MS = 4_000;

export type FetchLike = (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>;
export type Sleep = (milliseconds: number) => Promise<void>;
export type Clock = () => number;

export interface HarnessHttpClientOptions {
  paceMs?: number;
  fetch?: FetchLike;
  sleep?: Sleep;
  now?: Clock;
  userAgent?: string;
}

export interface HarnessHttpResponse {
  url: string;
  status: number;
  headers: Headers;
  body: string;
  blocked: boolean;
  blockedReason?: string;
}

const defaultSleep: Sleep = async (milliseconds) => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

const challengeMarkers = [
  'solveSimpleChallenge',
  '/sorry/index',
  'unusual traffic from your computer network',
  'our systems have detected unusual traffic'
] as const;

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (value === null) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000);
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return null;
  }

  return Math.max(0, date - now);
}

export function detectBlockedResponse(status: number, body: string): string | null {
  if (status === 429) {
    return 'Blogger returned HTTP 429 (rate limited).';
  }

  const normalizedBody = body.toLowerCase();
  const marker = challengeMarkers.find((candidate) => normalizedBody.includes(candidate.toLowerCase()));
  return marker ? `Blogger anti-bot challenge detected (${marker}).` : null;
}

export class HarnessHttpClient {
  readonly #paceMs: number;
  readonly #fetch: FetchLike;
  readonly #sleep: Sleep;
  readonly #now: Clock;
  readonly #userAgent: string;
  #queue: Promise<void> = Promise.resolve();
  #nextRequestAt = 0;

  constructor(options: HarnessHttpClientOptions = {}) {
    const paceMs = options.paceMs ?? Number.parseInt(process.env.HARNESS_PACE_MS ?? '4000', 10);
    if (!Number.isInteger(paceMs) || paceMs < MINIMUM_PACE_MS) {
      throw new Error(`Harness request pace must be an integer >= ${MINIMUM_PACE_MS}ms.`);
    }

    this.#paceMs = paceMs;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#sleep = options.sleep ?? defaultSleep;
    this.#now = options.now ?? Date.now;
    this.#userAgent = options.userAgent ?? 'ledger-blogger-theme-render-harness/0.0 (gzip)';
  }

  async get(url: URL | string, init: RequestInit = {}): Promise<HarnessHttpResponse> {
    let releaseQueue!: () => void;
    const previous = this.#queue;
    this.#queue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previous;
    try {
      const waitMs = Math.max(0, this.#nextRequestAt - this.#now());
      if (waitMs > 0) {
        await this.#sleep(waitMs);
      }

      const headers = new Headers(init.headers);
      headers.set('accept-encoding', 'gzip');
      headers.set('user-agent', this.#userAgent);

      const response = await this.#fetch(url, {
        ...init,
        method: 'GET',
        redirect: 'follow',
        headers
      });
      const body = await response.text();
      const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'), this.#now());
      this.#nextRequestAt = this.#now() + Math.max(this.#paceMs, retryAfterMs ?? 0);

      const blockedReason = detectBlockedResponse(response.status, body);
      return {
        url: response.url || String(url),
        status: response.status,
        headers: response.headers,
        body,
        blocked: blockedReason !== null,
        ...(blockedReason ? { blockedReason } : {})
      };
    } finally {
      releaseQueue();
    }
  }
}
