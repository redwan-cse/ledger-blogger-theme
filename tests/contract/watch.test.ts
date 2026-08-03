import { describe, expect, it, vi } from 'vitest';
import { BuildScheduler } from '../../tools/watch.js';

describe('generation watch scheduler', () => {
  it('coalesces changes while a build is running, then regenerates once more', async () => {
    let release!: () => void;
    const firstBuild = new Promise<void>((resolve) => { release = resolve; });
    const build = vi.fn()
      .mockImplementationOnce(async () => firstBuild)
      .mockResolvedValue(undefined);
    const scheduler = new BuildScheduler(build, vi.fn());

    scheduler.trigger('theme.pug');
    scheduler.trigger('styles/main.scss');
    scheduler.trigger('scripts/main.ts');
    release();
    await scheduler.idle();

    expect(build).toHaveBeenCalledTimes(2);
  });

  it('reports a failed build and remains alive for the next change', async () => {
    const messages: string[] = [];
    const build = vi.fn()
      .mockRejectedValueOnce(new Error('bad source'))
      .mockResolvedValueOnce(undefined);
    const scheduler = new BuildScheduler(build, (message) => messages.push(message));

    scheduler.trigger('theme.pug');
    await scheduler.idle();
    scheduler.trigger('theme.pug');
    await scheduler.idle();

    expect(build).toHaveBeenCalledTimes(2);
    expect(messages).toContain('Generation failed: bad source');
    expect(messages.at(-1)).toBe('Generated dist/theme.xml.');
  });
});
