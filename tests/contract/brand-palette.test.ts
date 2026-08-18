import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';
const SHA='0123456789abcdef0123456789abcdef01234567';
describe('shared Redwan brand palette',()=>{
  it('ships the approved light and dark foundations',async()=>{const t=await readFile('src/styles/tokens.scss','utf8'); expect(t).toContain('#2563EB'); expect(t).toContain('#020817'); expect(t).toContain('#161C2A'); expect(t).toContain('#3B82F6');});
  it('removes the former oxidised-red accent',async()=>{const {xml}=await generateTheme({sha:SHA,write:false}); expect(xml).not.toContain('0.148 25'); expect(xml).toContain('54.615% 0.2152 262.881');});
  it('keeps soft shared-site radii and flat card elevation',async()=>{const t=await readFile('src/styles/tokens.scss','utf8'); expect(t).toContain('$shadow-sm: none'); const {xml}=await generateTheme({sha:SHA,write:false}); expect(xml).toContain('border-radius:12px');});
});
