export interface SubmitUrlsOptions {
  urls: string[];
  bingApiKey?: string;
  indexNowKey?: string;
  indexNowKeyLocation?: string;
  siteUrl?: string;
  dryRun?: boolean;
}

export interface SubmissionResult {
  engine: 'bing' | 'indexnow';
  status: 'success' | 'warning' | 'skipped' | 'failed';
  message: string;
  statusCode?: number;
  submittedCount?: number;
}

const DEFAULT_SITE_URL = 'https://blogs.redwan.work/';

/**
 * Normalizes, validates and deduplicates an array of URLs.
 */
export function normalizeUrls(rawUrls: string[], baseSiteUrl = DEFAULT_SITE_URL): string[] {
  const base = new URL(baseSiteUrl);
  const normalized = new Set<string>();

  for (const raw of rawUrls) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const parsed = new URL(trimmed);
        normalized.add(parsed.toString());
      } else if (trimmed.startsWith('/')) {
        const parsed = new URL(trimmed, base.origin);
        normalized.add(parsed.toString());
      }
    } catch {
      // Ignore malformed URLs
    }
  }

  return Array.from(normalized);
}

/**
 * Submits URLs to the Bing Webmaster URL Submission API.
 * Uses the Bing Webmaster API Key directly associated with verified sites.
 * Requires NO .txt key file on the host.
 */
export async function submitToBingWebmaster(
  urls: string[],
  apiKey: string,
  siteUrl = DEFAULT_SITE_URL,
  dryRun = false
): Promise<SubmissionResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return {
      engine: 'bing',
      status: 'skipped',
      message: 'Bing Webmaster API Key not provided (set BING_WEBMASTER_API_KEY secret).'
    };
  }

  if (urls.length === 0) {
    return {
      engine: 'bing',
      status: 'skipped',
      message: 'No URLs provided for Bing submission.'
    };
  }

  // Ensure siteUrl has standard format (Bing accepts e.g. "https://blogs.redwan.work/" or "https://blogs.redwan.work")
  const normalizedSiteUrl = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;

  if (dryRun) {
    console.log(`[DRY-RUN] [Bing Webmaster API] Would submit ${urls.length} URL(s) for site ${normalizedSiteUrl}:`);
    urls.forEach((u) => console.log(`  - ${u}`));
    return {
      engine: 'bing',
      status: 'success',
      message: `[DRY-RUN] Would submit ${urls.length} URL(s) to Bing Webmaster Tools.`,
      statusCode: 200,
      submittedCount: urls.length
    };
  }

  try {
    const isSingle = urls.length === 1;
    const endpoint = isSingle
      ? `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrl?apikey=${encodeURIComponent(trimmedKey)}`
      : `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${encodeURIComponent(trimmedKey)}`;

    const body = isSingle
      ? JSON.stringify({ siteUrl: normalizedSiteUrl, url: urls[0] })
      : JSON.stringify({ siteUrl: normalizedSiteUrl, urlList: urls });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body
    });

    if (response.ok) {
      console.log(`✅ [Bing Webmaster] Successfully submitted ${urls.length} URL(s) to Bing search indexing queue!`);
      urls.forEach((u) => console.log(`   🔗 ${u}`));
      return {
        engine: 'bing',
        status: 'success',
        message: `Successfully submitted ${urls.length} URL(s) to Bing Webmaster Tools.`,
        statusCode: response.status,
        submittedCount: urls.length
      };
    }

    const errText = await response.text();
    let parsedErr = errText;
    try {
      const errJson = JSON.parse(errText);
      parsedErr = errJson.Message || errJson.message || errJson.ErrorCode || errText;
    } catch {
      // Keep errText
    }

    const warnMsg = `Bing Webmaster API returned status ${response.status}: ${parsedErr}`;
    console.warn(`⚠️ [Bing Webmaster] ${warnMsg}`);
    return {
      engine: 'bing',
      status: 'warning',
      message: warnMsg,
      statusCode: response.status
    };
  } catch (err: any) {
    const errMsg = `Network error calling Bing Webmaster API: ${err?.message || err}`;
    console.warn(`⚠️ [Bing Webmaster] ${errMsg}`);
    return {
      engine: 'bing',
      status: 'failed',
      message: errMsg
    };
  }
}

/**
 * Submits URLs to the IndexNow API (shared across Bing, Yandex, Seznam, Naver).
 */
export async function submitToIndexNow(
  urls: string[],
  key: string,
  keyLocation?: string,
  dryRun = false
): Promise<SubmissionResult> {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return {
      engine: 'indexnow',
      status: 'skipped',
      message: 'IndexNow Key not provided (set INDEXNOW_KEY secret).'
    };
  }

  if (urls.length === 0) {
    return {
      engine: 'indexnow',
      status: 'skipped',
      message: 'No URLs provided for IndexNow submission.'
    };
  }

  const firstUrlStr = urls[0];
  if (!firstUrlStr) {
    return {
      engine: 'indexnow',
      status: 'skipped',
      message: 'No URLs provided for IndexNow submission.'
    };
  }

  const firstUrl = new URL(firstUrlStr);
  const host = firstUrl.hostname;

  if (dryRun) {
    console.log(`[DRY-RUN] [IndexNow API] Would submit ${urls.length} URL(s) for host ${host}:`);
    urls.forEach((u) => console.log(`  - ${u}`));
    return {
      engine: 'indexnow',
      status: 'success',
      message: `[DRY-RUN] Would submit ${urls.length} URL(s) to IndexNow.`,
      statusCode: 200,
      submittedCount: urls.length
    };
  }

  try {
    const payload: {
      host: string;
      key: string;
      keyLocation?: string;
      urlList: string[];
    } = {
      host,
      key: trimmedKey,
      urlList: urls
    };

    if (keyLocation?.trim()) {
      payload.keyLocation = keyLocation.trim();
    }

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    // IndexNow returns 200 (OK) or 202 (Accepted) on success
    if (response.status === 200 || response.status === 202) {
      console.log(`✅ [IndexNow] Successfully submitted ${urls.length} URL(s) via IndexNow protocol (HTTP ${response.status})!`);
      urls.forEach((u) => console.log(`   🔗 ${u}`));
      return {
        engine: 'indexnow',
        status: 'success',
        message: `Submitted ${urls.length} URL(s) to IndexNow (status ${response.status}).`,
        statusCode: response.status,
        submittedCount: urls.length
      };
    }

    const errText = await response.text();
    const warnMsg = `IndexNow API returned status ${response.status}: ${errText}`;
    console.warn(`⚠️ [IndexNow] ${warnMsg}`);
    return {
      engine: 'indexnow',
      status: 'warning',
      message: warnMsg,
      statusCode: response.status
    };
  } catch (err: any) {
    const errMsg = `Network error calling IndexNow API: ${err?.message || err}`;
    console.warn(`⚠️ [IndexNow] ${errMsg}`);
    return {
      engine: 'indexnow',
      status: 'failed',
      message: errMsg
    };
  }
}

/**
 * High-level coordinator: Submits URLs to all configured search engine indexing APIs.
 * Safe and non-blocking: never throws unhandled exceptions that break publishing.
 */
export async function submitUrlsToSearchEngines(
  options: SubmitUrlsOptions
): Promise<SubmissionResult[]> {
  const siteUrl = options.siteUrl || DEFAULT_SITE_URL;
  const urls = normalizeUrls(options.urls, siteUrl);

  if (urls.length === 0) {
    console.log('ℹ️ Search engine indexing: No valid URLs to submit.');
    return [];
  }

  console.log(`\n======================================================`);
  console.log(`📡 Search Engine Indexing Submission (${urls.length} URL${urls.length === 1 ? '' : 's'})`);
  console.log(`======================================================`);

  const results: SubmissionResult[] = [];

  // 1. Bing Webmaster URL Submission API (Native, Verified Site, 100% Reliable on Blogger)
  if (options.bingApiKey?.trim()) {
    const bingRes = await submitToBingWebmaster(urls, options.bingApiKey, siteUrl, options.dryRun);
    results.push(bingRes);
  } else {
    console.log('ℹ️ Bing Webmaster: BING_WEBMASTER_API_KEY secret not set. Skipping native Bing submission.');
    results.push({
      engine: 'bing',
      status: 'skipped',
      message: 'BING_WEBMASTER_API_KEY not configured.'
    });
  }

  // 2. IndexNow Protocol (Shares with Bing, Yandex, Seznam, Naver)
  if (options.indexNowKey?.trim()) {
    const indexNowRes = await submitToIndexNow(
      urls,
      options.indexNowKey,
      options.indexNowKeyLocation,
      options.dryRun
    );
    results.push(indexNowRes);
  } else {
    console.log('ℹ️ IndexNow: INDEXNOW_KEY secret not set. Skipping IndexNow submission.');
    results.push({
      engine: 'indexnow',
      status: 'skipped',
      message: 'INDEXNOW_KEY not configured.'
    });
  }

  console.log(`======================================================\n`);
  return results;
}
