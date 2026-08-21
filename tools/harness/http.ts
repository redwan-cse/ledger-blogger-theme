export const MINIMUM_PACE_MS = 4_000;
export const DEFAULT_TIMEOUT_MS = 30_000;

export type FetchLike = (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>;
export type Sleep = (milliseconds: number) => Promise<void>;
export type Clock = () => number;

export interface HarnessHttpClientOptions {
  paceMs?: number;
  timeoutMs?: number;
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

const quotaReasons = new Set([
  'ratelimitexceeded',
  'userratelimitexceeded',
  'dailylimitexceeded',
  'quotaexceeded'
]);

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

function googleApiErrorReasons(body: string): string[] {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || !('error' in parsed)) return [];
    const error = (parsed as { error?: unknown }).error;
    if (typeof error !== 'object' || error === null || !('errors' in error)) return [];
    const errors = (error as { errors?: unknown }).errors;
    if (!Array.isArray(errors)) return [];
    return errors.flatMap((item) => {
      if (typeof item !== 'object' || item === null || !('reason' in item)) return [];
      const reason = (item as { reason?: unknown }).reason;
      return typeof reason === 'string' ? [reason] : [];
    });
  } catch { return []; }
}

export function detectBlockedResponse(status: number, body: string): string | null {
  if (status === 429) return 'Blogger returned HTTP 429 (rate limited).';
  if (status === 403) {
    const reason = googleApiErrorReasons(body).find((candidate) => quotaReasons.has(candidate.toLowerCase()));
    if (reason) return `Blogger API quota blocked the request (${reason}).`;
  }
  const normalizedBody = body.toLowerCase();
  const marker = challengeMarkers.find((candidate) => normalizedBody.includes(candidate.toLowerCase()));
  return marker ? `Blogger anti-bot challenge detected (${marker}).` : null;
}

export class HarnessHttpClient {
  readonly #paceMs: number;
  readonly #timeoutMs: number;
  readonly #fetch: FetchLike;
  readonly #sleep: Sleep;
  readonly #now: Clock;
  readonly #userAgent: string;
  #queue: Promise<void> = Promise.resolve();
  readonly #nextRequestAtByHost = new Map<string, number>();

  constructor(options: HarnessHttpClientOptions = {}) {
    const paceMs = options.paceMs ?? Number.parseInt(process.env.HARNESS_PACE_MS ?? '4000', 10);
    if (!Number.isInteger(paceMs) || paceMs < MINIMUM_PACE_MS) throw new Error(`Harness request pace must be an integer >= ${MINIMUM_PACE_MS}ms.`);
    const timeoutMs = options.timeoutMs ?? Number.parseInt(process.env.HARNESS_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS), 10);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error('Harness request timeout must be a positive integer.');
    this.#paceMs = paceMs;
    this.#timeoutMs = timeoutMs;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#sleep = options.sleep ?? defaultSleep;
    this.#now = options.now ?? Date.now;
    this.#userAgent = options.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  }

  async get(url: URL | string, init: RequestInit = {}): Promise<HarnessHttpResponse> {
    let releaseQueue!: () => void;
    const previous = this.#queue;
    this.#queue = new Promise<void>((resolve) => { releaseQueue = resolve; });
    await previous;
    const requestUrl = new URL(String(url));
    const host = requestUrl.host;
    try {
      let attempts = 0;
      while (true) {
        attempts += 1;
        const waitMs = Math.max(0, (this.#nextRequestAtByHost.get(host) ?? 0) - this.#now());
        if (waitMs > 0) await this.#sleep(waitMs);
        this.#nextRequestAtByHost.set(host, this.#now() + this.#paceMs);
        const headers = new Headers(init.headers);
        headers.set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8');
        headers.set('accept-language', 'en-US,en;q=0.9');
        headers.set('accept-encoding', 'gzip, deflate, br');
        headers.set('user-agent', this.#userAgent);
        headers.set('sec-ch-ua', '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"');
        headers.set('sec-ch-ua-mobile', '?0');
        headers.set('sec-ch-ua-platform', '"Windows"');
        headers.set('sec-fetch-dest', 'document');
        headers.set('sec-fetch-mode', 'navigate');
        headers.set('sec-fetch-site', 'none');
        headers.set('sec-fetch-user', '?1');
        headers.set('upgrade-insecure-requests', '1');
        const timeoutSignal = AbortSignal.timeout(this.#timeoutMs);
        const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
        const response = await this.#fetch(requestUrl, { ...init, method: 'GET', redirect: 'follow', headers, signal });
        const body = await response.text();
        const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'), this.#now());
        if (retryAfterMs !== null) this.#nextRequestAtByHost.set(host, Math.max(this.#nextRequestAtByHost.get(host) ?? 0, this.#now() + retryAfterMs));
        const blockedReason = detectBlockedResponse(response.status, body);
        if (response.status === 429 && attempts < 6) {
          const backoff = Math.max(retryAfterMs ?? 0, 15_000 * attempts);
          console.warn(`[HTTP 429] Host ${host} throttled attempt ${attempts}, backing off ${backoff / 1000}s...`);
          this.#nextRequestAtByHost.set(host, this.#now() + backoff);
          await this.#sleep(backoff);
          continue;
        }
        return { url: response.url || requestUrl.href, status: response.status, headers: response.headers, body, blocked: blockedReason !== null, ...(blockedReason ? { blockedReason } : {}) };
      }
    } finally { releaseQueue(); }
  }
}
