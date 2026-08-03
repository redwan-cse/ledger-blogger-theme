import { describe, expect, it } from 'vitest';
import {
  exitCodes,
  fatalHarnessSummary,
  summarizeHarnessRun,
  type HarnessAssertion
} from '../../tools/harness/result.js';

const assertion = (
  status: HarnessAssertion['status'],
  requirementId = 'R-EMPTY-1 AC1'
): HarnessAssertion => ({
  requirementId,
  status,
  message: `${requirementId} produced ${status}`,
  ...(status === 'BLOCKED' || status === 'SKIP'
    ? { evidence: status === 'BLOCKED' ? 'HTTP 429 with Retry-After' : 'Required seeded page is absent' }
    : {})
});

describe('harness result model', () => {
  it('uses stable, distinct exit codes for every terminal outcome', () => {
    expect(new Set(Object.values(exitCodes)).size).toBe(Object.keys(exitCodes).length);
    expect(exitCodes).toEqual({ PASS: 0, FAIL: 1, BLOCKED: 2, STALE: 3, SKIP: 4, ERROR: 5 });
  });

  it('passes only measured runs with no failures or blockers', () => {
    const summary = summarizeHarnessRun([assertion('PASS'), assertion('SKIP', 'R-RENDER-4 AC1')]);

    expect(summary.outcome).toBe('PASS');
    expect(summary.exitCode).toBe(0);
    expect(summary.counts).toEqual({ PASS: 1, FAIL: 0, BLOCKED: 0, SKIP: 1 });
  });

  it('makes any BLOCKED assertion inconclusive even when a defect was also measured', () => {
    const summary = summarizeHarnessRun([assertion('BLOCKED'), assertion('FAIL', 'R-RENDER-1 AC1')]);

    expect(summary.outcome).toBe('BLOCKED');
    expect(summary.exitCode).toBe(exitCodes.BLOCKED);
    expect(summary.counts).toEqual({ PASS: 0, FAIL: 1, BLOCKED: 1, SKIP: 0 });
  });

  it('reports throttling or a challenge as BLOCKED, never PASS or FAIL', () => {
    const summary = summarizeHarnessRun([assertion('PASS'), assertion('BLOCKED', 'R-RENDER-1 AC5')]);

    expect(summary.outcome).toBe('BLOCKED');
    expect(summary.exitCode).toBe(exitCodes.BLOCKED);
  });

  it('returns SKIP when no assertion could be measured', () => {
    const summary = summarizeHarnessRun([assertion('SKIP')]);

    expect(summary.outcome).toBe('SKIP');
    expect(summary.exitCode).toBe(exitCodes.SKIP);
  });

  it('gates a stale deployment before validating or retaining assertions', () => {
    const summary = summarizeHarnessRun(
      [{ requirementId: '', status: 'PASS', message: '' }],
      { expected: '1.0.0+abc123', deployed: '1.0.0+old456' }
    );

    expect(summary.outcome).toBe('STALE');
    expect(summary.exitCode).toBe(exitCodes.STALE);
    expect(summary.assertions).toEqual([]);
    expect(summary.counts).toEqual({ PASS: 0, FAIL: 0, BLOCKED: 0, SKIP: 0 });
    expect(summary.reason).toContain('Upload the expected build before running assertions.');
  });

  it('treats a missing deployed stamp as STALE', () => {
    const summary = summarizeHarnessRun([], { expected: '1.0.0+abc123', deployed: null });

    expect(summary.outcome).toBe('STALE');
    expect(summary.reason).toContain('deployed missing');
  });

  it('rejects assertions without requirement IDs', () => {
    expect(() => summarizeHarnessRun([{ requirementId: ' ', status: 'PASS', message: 'visible' }]))
      .toThrow('requirement ID');
  });

  it('requires evidence for BLOCKED and SKIP states', () => {
    expect(() => summarizeHarnessRun([
      { requirementId: 'R-RENDER-1 AC3', status: 'BLOCKED', message: 'not measured' }
    ])).toThrow('requires evidence');
  });

  it('keeps feed or infrastructure failures separate from theme failures', () => {
    const summary = fatalHarnessSummary('Blogger feed could not be fetched.');

    expect(summary.outcome).toBe('ERROR');
    expect(summary.exitCode).toBe(exitCodes.ERROR);
    expect(summary.assertions).toEqual([]);
  });
});
