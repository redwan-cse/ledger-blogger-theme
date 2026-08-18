import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { generateTheme } from '../../tools/generate.js';
const SHA='0123456789abcdef0123456789abcdef01234567';
describe('live UI regressions',()=>{
  it('renders a stable two-line brand',async()=>{const {xml}=await generateTheme({sha:SHA,write:false}); expect(xml).toContain('<h1 class="site-title">Md Redwan Ahmed</h1>'); expect(xml).toContain('<p class="site-tagline">Cyber Security Professional</p>');});
  it('does not invoke a duplicate threaded form',async()=>{const s=await readFile('src/widgets/blog-comments.pug','utf8'); const x=s.slice(s.indexOf("b:includable(id='threadedComments'"),s.indexOf("b:includable(id='threadedCommentForm'")); expect(x).not.toContain("name='threadedCommentForm'");});
  it('styles native threaded comments',async()=>{const {xml}=await generateTheme({sha:SHA,write:false}); expect(xml).toContain('#comments .comment-thread ol'); expect(xml).toContain('.avatar-image-container{position:absolute');});
});
