import { extractThemeBuild } from './harness/build-stamp.js';
import { HarnessHttpClient } from './harness/http.js';
import { exitCodes } from './harness/result.js';

const url = process.env.STAGING_URL?.trim();
const expected = process.env.EXPECTED_THEME_BUILD?.trim();
if (!url || !expected) throw new Error('STAGING_URL and EXPECTED_THEME_BUILD are required.');
const response = await new HarnessHttpClient().get(new URL(url));
if (response.blocked) { console.error(response.blockedReason); process.exitCode = exitCodes.BLOCKED; }
else {
  const deployed = extractThemeBuild(response.body);
  if (deployed !== expected) { console.error(`STALE: expected ${expected}, deployed ${deployed ?? 'missing'}. Upload the expected theme before asserting.`); process.exitCode = exitCodes.STALE; }
  else console.log(`PASS: deployed theme build is ${deployed}.`);
}


