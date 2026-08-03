export const assertionStatuses = ['PASS', 'FAIL', 'BLOCKED', 'SKIP'] as const;
export type AssertionStatus = (typeof assertionStatuses)[number];

export const runOutcomes = ['PASS', 'FAIL', 'BLOCKED', 'SKIP', 'STALE', 'ERROR'] as const;
export type RunOutcome = (typeof runOutcomes)[number];

export const exitCodes = {
  PASS: 0,
  FAIL: 1,
  BLOCKED: 2,
  STALE: 3,
  SKIP: 4,
  ERROR: 5
} as const satisfies Record<RunOutcome, number>;

export interface HarnessAssertion {
  requirementId: string;
  status: AssertionStatus;
  message: string;
  evidence?: string;
}

export interface BuildStampGate {
  expected: string;
  deployed: string | null;
}

export interface HarnessSummary {
  outcome: RunOutcome;
  exitCode: number;
  assertions: readonly HarnessAssertion[];
  counts: Readonly<Record<AssertionStatus, number>>;
  reason?: string;
}

const emptyCounts = (): Record<AssertionStatus, number> => ({
  PASS: 0,
  FAIL: 0,
  BLOCKED: 0,
  SKIP: 0
});

function validateAssertion(assertion: HarnessAssertion): void {
  if (assertion.requirementId.trim().length === 0) {
    throw new Error('Every harness assertion must name a requirement ID.');
  }

  if (assertion.message.trim().length === 0) {
    throw new Error(`${assertion.requirementId} must include a diagnostic message.`);
  }

  if ((assertion.status === 'BLOCKED' || assertion.status === 'SKIP') && !assertion.evidence?.trim()) {
    throw new Error(`${assertion.requirementId} ${assertion.status} requires evidence explaining why it was not measured.`);
  }
}

export function summarizeHarnessRun(
  assertions: readonly HarnessAssertion[],
  gate?: BuildStampGate
): HarnessSummary {
  if (gate && gate.deployed !== gate.expected) {
    const deployed = gate.deployed ?? 'missing';
    return {
      outcome: 'STALE',
      exitCode: exitCodes.STALE,
      assertions: [],
      counts: emptyCounts(),
      reason: `Build stamp mismatch: expected ${gate.expected}, deployed ${deployed}. Upload the expected build before running assertions.`
    };
  }

  for (const assertion of assertions) {
    validateAssertion(assertion);
  }

  const counts = emptyCounts();
  for (const assertion of assertions) {
    counts[assertion.status] += 1;
  }

  let outcome: RunOutcome;
  if (counts.BLOCKED > 0) {
    outcome = 'BLOCKED';
  } else if (counts.FAIL > 0) {
    outcome = 'FAIL';
  } else if (counts.PASS > 0) {
    outcome = 'PASS';
  } else {
    outcome = 'SKIP';
  }

  return {
    outcome,
    exitCode: exitCodes[outcome],
    assertions: [...assertions],
    counts
  };
}

export function fatalHarnessSummary(reason: string): HarnessSummary {
  if (reason.trim().length === 0) {
    throw new Error('A fatal harness result requires a reason.');
  }

  return {
    outcome: 'ERROR',
    exitCode: exitCodes.ERROR,
    assertions: [],
    counts: emptyCounts(),
    reason
  };
}
