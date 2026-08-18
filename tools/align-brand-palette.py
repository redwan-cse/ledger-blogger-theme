from pathlib import Path
import re

p = Path('src/styles/tokens.scss')
s = p.read_text()
old = """// OKLCH Palette (7 canonical tokens — hue families locked by contract tests)
// Neutral family: hue 85 (warm paper). Accent family: hue 25 (oxidised red).
$page: oklch(98.4% 0.004 85);
$surface: oklch(96.2% 0.006 85);
$ink: oklch(23% 0.012 85);
$ink-muted: oklch(48% 0.010 85);
$rule: oklch(89% 0.006 85);
$accent: oklch(46% 0.148 25);
$accent-wash: oklch(94% 0.028 25);"""
new = """// Shared Redwan brand palette, derived from redwan.work and Fast Cyber Defense.
// Light mode follows redwan.work; dark mode uses the shared blue/slate family.
$page: oklch(100% 0 0);                  // #FFFFFF
$surface: oklch(98.415% 0.0034 247.858); // #F8FAFC
$ink: oklch(14.479% 0 0);                // #0A0A0A
$ink-muted: oklch(54.863% 0 0);          // #717171
$rule: oklch(92.876% 0.0126 255.508);    // #E2E8F0
$accent: oklch(54.615% 0.2152 262.881);  // #2563EB
$accent-wash: oklch(97.048% 0.0142 254.604); // #EFF6FF

$dark-page: oklch(13.627% 0.0364 259.201);       // #020817
$dark-surface: oklch(22.749% 0.0288 266.273);    // #161C2A
$dark-ink: oklch(98.415% 0.0034 247.858);        // #F8FAFC
$dark-muted: oklch(65.613% 0.0019 247.851);      // #909192
$dark-rule: oklch(27.950% 0.0368 260.031);       // #1E293B
$dark-accent: oklch(62.308% 0.1880 259.815);     // #3B82F6
$dark-highlight: oklch(69.234% 0.1502 259.735);  // #629BF8"""
if old not in s:
    raise SystemExit('canonical token block changed')
s = s.replace(old, new)
s = s.replace("$font-sans: -apple-system, system-ui, 'Segoe UI', roboto, sans-serif;", "$font-sans: 'Inter', -apple-system, system-ui, 'Segoe UI', roboto, sans-serif;")
for token in ('shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-accent-sm', 'shadow-accent-md'):
    s = re.sub(rf'\${token}:.*?;', f'${token}: none;', s)
s = s.replace('$glass-bg: oklch(98.4% 0.004 85 / 0.85);', '$glass-bg: oklch(100% 0 0 / 0.88);')
s = s.replace('$glass-bg-drawer: oklch(98.4% 0.004 85 / 0.92);', '$glass-bg-drawer: oklch(100% 0 0 / 0.94);')
s = s.replace('$glass-bg-modal: oklch(98.4% 0.004 85 / 0.96);', '$glass-bg-modal: oklch(100% 0 0 / 0.97);')
s = s.replace('$glass-border: 1px solid oklch(89% 0.006 85 / 0.6);', '$glass-border: 1px solid oklch(92.876% 0.0126 255.508 / 0.8);')
s = s.replace('$card-hover-lift: translateY(-4px);', '$card-hover-lift: translateY(-1px);')
p.write_text(s)

color_map = {
    '46% 0.148 25': '54.615% 0.2152 262.881', '40% 0.148 25': '48% 0.205 263',
    '56% 0.148 25': '62.308% 0.1880 259.815', '60% 0.148 25': '62.308% 0.1880 259.815',
    '66% 0.148 25': '69.234% 0.1502 259.735', '94% 0.028 25': '97.048% 0.0142 254.604',
    '23% 0.012 85': '14.479% 0 0', '80% 0.01 85': '85% 0.018 255.508',
    '14% 0.015 260': '13.627% 0.0364 259.201', '18% 0.018 260': '22.749% 0.0288 266.273',
    '19% 0.02 260': '22.749% 0.0288 266.273', '20% 0.022 260': '22.749% 0.0288 266.273',
    '28% 0.018 260': '27.950% 0.0368 260.031', '96% 0.005 260': '98.415% 0.0034 247.858',
    '92% 0.01 260': '98.415% 0.0034 247.858', '68% 0.19 250': '62.308% 0.1880 259.815',
    '78% 0.14 250': '69.234% 0.1502 259.735', '62% 0.010 260': '65.613% 0.0019 247.851',
    '68% 0.012 260': '65.613% 0.0019 247.851', '72% 0.012 260': '69.234% 0.015 255',
    '76% 0.012 260': '72% 0.015 255', '24% 0.045 250': '27.950% 0.0368 260.031'
}
for path in Path('src/styles').glob('*.scss'):
    text = path.read_text()
    for before, after in color_map.items():
        text = text.replace(before, after)
    text = re.sub(r'border-radius:\s*(2|3|4|6|8)px', lambda m: 'border-radius: ' + {'2':'6','3':'6','4':'8','6':'8','8':'12'}[m.group(1)] + 'px', text)
    for shadow in (
        '0 4px 16px oklch(0% 0 0 / 0.35)', '0 8px 24px oklch(0% 0 0 / 0.45)',
        '0 6px 20px oklch(0% 0 0 / 0.35)', '0 8px 28px oklch(0% 0 0 / 0.45)'):
        text = text.replace(f'box-shadow: {shadow};', 'box-shadow: none;')
    path.write_text(text)

p = Path('tests/contract/token-contrast.test.ts')
s = p.read_text().replace('const PAGE: Oklch = [0.984, 0.004, 85];', 'const PAGE: Oklch = [1, 0, 0];')
s = s.replace('const INK: Oklch = [0.23, 0.012, 85];', 'const INK: Oklch = [0.14479, 0, 0];')
s = s.replace('const ACCENT: Oklch = [0.46, 0.148, 25];', 'const ACCENT: Oklch = [0.54615, 0.2152, 262.881];')
p.write_text(s)

p = Path('tests/contract/m3-design-system.test.ts')
s = p.read_text()
old_focus = r"expect(xml).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+oklch\((?:46%|\.46|0\.46)\s+0?\.148\s+25\);[^}]*outline-offset:\s*2px/);"
new_focus = r"expect(xml).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px\s+solid\s+oklch\(54\.615%\s+0\.2152\s+262\.881\);[^}]*outline-offset:\s*2px/);"
if old_focus not in s:
    raise SystemExit('focus-ring contract changed')
p.write_text(s.replace(old_focus, new_focus))

Path('tests/contract/brand-palette.test.ts').write_text("""import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';
const SHA='0123456789abcdef0123456789abcdef01234567';
describe('shared Redwan brand palette',()=>{
  it('ships the approved light and dark foundations',async()=>{const t=await readFile('src/styles/tokens.scss','utf8'); expect(t).toContain('#2563EB'); expect(t).toContain('#020817'); expect(t).toContain('#161C2A'); expect(t).toContain('#3B82F6');});
  it('removes the former oxidised-red accent',async()=>{const {xml}=await generateTheme({sha:SHA,write:false}); expect(xml).not.toContain('0.148 25'); expect(xml).toContain('54.615% 0.2152 262.881');});
  it('keeps soft shared-site radii and flat card elevation',async()=>{const t=await readFile('src/styles/tokens.scss','utf8'); expect(t).toContain('$shadow-sm: none'); const {xml}=await generateTheme({sha:SHA,write:false}); expect(xml).toContain('border-radius:12px');});
});
""")

p = Path('docs/PROJECT-PLAN.md')
s = p.read_text()
marker = '### 2.2 Colour\n'
note = marker + "\n> **Superseded 2026-08-19:** Ledger now uses the shared Redwan blue/slate brand family derived from redwan.work and Fast Cyber Defense. Light mode uses `#FFFFFF`, `#F8FAFC`, `#0A0A0A`, `#717171`, `#E2E8F0`, `#2563EB`, and `#EFF6FF`; dark mode uses `#020817`, `#161C2A`, `#F8FAFC`, `#909192`, `#1E293B`, `#3B82F6`, and `#629BF8`. The original warm-paper/oxidised-red rationale below is historical.\n"
if s.count(marker) != 1:
    raise SystemExit('project colour section changed')
p.write_text(s.replace(marker, note))

Path('docs/BRAND-PALETTE-2026-08-19.md').write_text("""# Ledger shared brand palette

Ledger now belongs to the same visual family as redwan.work and Fast Cyber Defense while retaining its editorial layout and long-form typography.

## Light

| Role | Value |
|---|---|
| Page | `#FFFFFF` |
| Surface | `#F8FAFC` |
| Text | `#0A0A0A` |
| Muted | `#717171` |
| Border | `#E2E8F0` |
| Primary | `#2563EB` |
| Accent wash | `#EFF6FF` |

## Dark

| Role | Value |
|---|---|
| Page | `#020817` |
| Elevated | `#161C2A` |
| Text | `#F8FAFC` |
| Muted | `#909192` |
| Border | `#1E293B` |
| Primary | `#3B82F6` |
| Highlight | `#629BF8` |

## Shape and elevation

Use the shared 4px rhythm, 8px controls, 12px cards and dialogs, and flat default elevation. Drawers and modal backdrops may retain stronger depth because they must separate from page content.

## Identity rule

Blue is the only interactive accent family. Ledger keeps its editorial hierarchy and reading measure, so the sites feel related rather than cloned.
""")
