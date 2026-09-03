async function check() {
  const url = 'https://blogs.redwan.work/2026/09/dissecting-kerberoasting-protocol_0229686542.html';
  const res = await fetch(url);
  const text = await res.text();

  console.log('--- POST VERIFICATION REPORT ---');
  console.log('HTTP Status:', res.status);
  console.log('Post Title:', text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.trim());
  console.log('Author Display:', text.match(/class=['"]post-author-mini-name['"]>\s*([^<\n]+)/i)?.[1]?.trim());
  console.log('Has Hero Image:', text.includes('post-hero-image'));
  console.log('Hero Image Source Type:', text.includes('src="data:image/png;base64') ? 'Base64 Inline (100% immune to 404)' : 'External URL');
  console.log('Mermaid Diagram Count:', (text.match(/class=['"]mermaid['"]/gi) || []).length);
  console.log('Mermaid Script Injected:', text.includes('mermaid.esm.min.mjs'));

  const codeBlocks = text.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi) || [];
  console.log('Code Blocks Count:', codeBlocks.length);
  if (codeBlocks.length > 0 && codeBlocks[0]) {
    const lines = codeBlocks[0].replace(/<[^>]+>/g, '').split('\n');
    console.log('First Code Block Lines Count:', lines.length);
    console.log('First 5 lines sample:\n' + lines.slice(0, 5).join('\n'));
  }
}

check().catch(console.error);
