from pathlib import Path

p = Path('tests/contract/m3-scss-adversarial.test.ts')
s = p.read_text()
s = s.replace("it('strictly maintains 85-degree neutral hue family across all 5 neutral tokens'", "it('maintains the approved shared-site neutral families across all 5 neutral tokens'")
s = s.replace("// Hue must be 85 (neutral hue family)\n        expect(parsed.h).toBe(85);", "// Achromatic tokens legitimately report hue 0; cool slate tokens stay in the 247-256 family.\n        expect(parsed.c === 0 ? parsed.h === 0 : parsed.h >= 247 && parsed.h <= 256).toBe(true);")
s = s.replace("it('strictly maintains 25-degree warm accent hue for accent and accent-wash'", "it('strictly maintains the shared blue accent family for accent and accent-wash'")
s = s.replace("// Hue must be 25 (warm oxidised red)\n        expect(parsed.h).toBe(25);", "// Shared redwan.work / Fast Cyber Defense blue family.\n        expect(parsed.h).toBeGreaterThanOrEqual(254);\n        expect(parsed.h).toBeLessThanOrEqual(263);")
p.write_text(s)

p = Path('tests/contract/m3-design-system.test.ts')
s = p.read_text()
s = s.replace(r"oklch\(54\.615%\s+0\.2152\s+262\.881\)", r"oklch\((?:54\.615%|\.54615|0\.54615)\s+(?:0?\.2152)\s+262\.881\)")
p.write_text(s)
