import { HarnessHttpClient } from './harness/http.js';
import { fatalHarnessSummary, summarizeHarnessRun, type HarnessSummary } from './harness/result.js';

function requiredEnvironment(name: 'STAGING_URL' | 'EXPECTED_THEME_BUILD'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function extractThemeBuild(html: string): string | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    if (!/\bname\s*=\s*(['"])theme-build\1/i.test(tag)) {
      continue;
    }
    const content = tag.match(/\bcontent\s*=\s*(['"])(.*?)\1/i);
    return content?.[2]?.trim() || null;
  }
  return null;
}

function printSummary(summary: HarnessSummary): void {
  console.log(JSON.stringify(summary, null, 2));
}

async function main(): Promise<void> {
  let summary: HarnessSummary;
  try {
    const stagingUrl = new URL(requiredEnvironment('STAGING_URL'));
    const expectedBuild = requiredEnvironment('EXPECTED_THEME_BUILD');
    const client = new HarnessHttpClient();
    const response = await client.get(stagingUrl);

    if (response.blocked) {
      summary = summarizeHarnessRun([{
        requirementId: 'R-BUILD-2 AC2',
        status: 'BLOCKED',
        message: 'Build-stamp gate could not be measured.',
        evidence: response.blockedReason ?? `HTTP ${response.status}`
      }]);
    } else if (response.status < 200 || response.status >= 400) {
      summary = fatalHarnessSummary(`Staging homepage returned HTTP ${response.status}; no render assertions ran.`);
    } else {
      summary = summarizeHarnessRun([], {
        expected: expectedBuild,
        deployed: extractThemeBuild(response.body)
      });
    }
  } catch (error) {
    summary = fatalHarnessSummary(error instanceof Error ? error.message : String(error));
  }

  printSummary(summary);
  process.exitCode = summary.exitCode;
}

await main();
