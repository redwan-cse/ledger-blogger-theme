import { describe, expect, it } from 'vitest';
import { extractThemeBuild } from '../../tools/harness/build-stamp.js';

describe('render harness build-stamp parsing', () => {
  it('reads the deployed build stamp regardless of attribute order', () => {
    expect(extractThemeBuild("<meta content='1.0.0+abc123' name='theme-build'>")).toBe('1.0.0+abc123');
    expect(extractThemeBuild('<meta name="theme-build" content="1.0.0+def456">')).toBe('1.0.0+def456');
  });

  it('returns null when Blogger output has no build stamp', () => {
    expect(extractThemeBuild('<html><head><title>Empty theme</title></head></html>')).toBeNull();
  });
});
