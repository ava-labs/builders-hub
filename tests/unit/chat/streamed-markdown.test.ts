import { describe, expect, it } from 'vitest';
import { markdownToSafeHtml } from '@/utils/sanitizeMarkdown';

/* While an answer streams, the chat page sets its text as HTML. The text is
   model output, and a question can ask the model to repeat any tag, so only
   the tags and attributes on the allowlist may reach the page. */

const MARKUP = [
  '<img src=x onerror=window.__xss=1>',
  '<img src=x onerror="alert(document.cookie)">test',
  '"><script src=https://probe.example/c/1></script>',
  "'><input onfocus=eval(atob(this.id)) id=YWxlcnQoMSk= autofocus>",
  "<svg onload=console.log('x')>",
  '<iframe src="https://probe.example/"></iframe><marquee>x</marquee>',
  '<a href="javascript:alert(1)">open</a>',
  '<a href="java&#x09;script:alert(1)">open</a>',
  '<div style="position:fixed;inset:0" onclick="alert(1)">cover</div>',
  '<style>body{display:none}</style>',
];

/** the HTML with text that was escaped (and so is inert) taken out */
const withoutEscapedText = (html: string) => html.replace(/&lt;[\s\S]*?&gt;/g, '');

describe('streamed chat text', () => {
  it.each(MARKUP)('drops tags, handlers and addresses that are not on the allowlist: %s', (payload) => {
    const html = markdownToSafeHtml(`Here it is:\n\n${payload}\n\n**done**`, { breaks: false });
    const live = withoutEscapedText(html);
    expect(live).not.toMatch(/<(img|script|input|svg|iframe|marquee|style)\b/i);
    expect(live).not.toMatch(/<[^>]*\s(on\w+|style)=/i);
    expect(live).not.toMatch(/href="\s*(javascript|data|vbscript):/i);
    expect(html).toContain('<strong>done</strong>');
  });

  it('keeps markdown, code blocks and http(s) links', () => {
    const html = markdownToSafeHtml(
      '# Title\n\n```ts\nconst a = 1;\n```\n\n[docs](https://build.avax.network/docs) [x](javascript:alert(1))',
      { breaks: false },
    );
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<pre><code class="language-ts">');
    expect(html).toContain('href="https://build.avax.network/docs"');
    expect(html).not.toContain('javascript:');
  });

  it('keeps a single newline inside a paragraph when breaks is off', () => {
    expect(markdownToSafeHtml('one\ntwo', { breaks: false })).not.toContain('<br');
    expect(markdownToSafeHtml('one\ntwo')).toContain('<br');
  });
});
