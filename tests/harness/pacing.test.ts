import { describe, expect, it, vi } from 'vitest';
import { SerializedPacer } from '../../tools/harness/pacing.js';

describe('serialized browser navigation pacing', () => {
  it('rejects a pace below the Blogger safety floor', () => {
    expect(() => new SerializedPacer(3_999)).toThrow('4000ms');
  });

  it('serializes concurrent navigation starts at least four seconds apart', async () => {
    let now = 5_000;
    const sleep = vi.fn(async (milliseconds: number) => {
      now += milliseconds;
    });
    const pacer = new SerializedPacer(4_000, sleep, () => now);

    const starts = await Promise.all([
      pacer.waitForTurn(),
      pacer.waitForTurn(),
      pacer.waitForTurn()
    ]);

    expect(starts).toEqual([5_000, 9_000, 13_000]);
    expect(sleep).toHaveBeenNthCalledWith(1, 4_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 4_000);
  });
});
