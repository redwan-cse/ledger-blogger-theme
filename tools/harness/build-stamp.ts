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
