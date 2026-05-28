// Minimal allowlist sanitizer for Getro job description HTML.
// Getro returns markup like <div><p>...</p><ul><li>...</li></ul></div> with
// occasional <strong>, <em>, <a>, <br>. We strip anything outside the
// allowlist, drop all attributes except href/title on anchors, and force
// anchors to open in a new tab.

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'a',
  'div',
  'span',
  'blockquote',
  'code',
  'pre',
  'hr',
]);

const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
};

const SAFE_URL_RE = /^(?:https?:|mailto:|tel:|\/)/i;

export function sanitizeJobHtml(input: string | null | undefined): string {
  if (!input) return '';

  // Strip <script>...</script> and <style>...</style> entirely (with content)
  let out = input.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  // Walk every tag and rewrite it
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    const isClosing = _.startsWith('</');
    if (isClosing) return `</${tag}>`;

    const isSelfClosing = tag === 'br' || tag === 'hr';
    const allowed = ALLOWED_ATTRS_BY_TAG[tag];
    let attrsOut = '';
    if (allowed) {
      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(rawAttrs))) {
        const name = m[1].toLowerCase();
        if (!allowed.has(name)) continue;
        const value = m[2] ?? m[3] ?? m[4] ?? '';
        if (name === 'href' && !SAFE_URL_RE.test(value)) continue;
        attrsOut += ` ${name}="${escapeAttr(value)}"`;
      }
      if (tag === 'a') {
        attrsOut += ' target="_blank" rel="noopener noreferrer nofollow"';
      }
    }

    return `<${tag}${attrsOut}${isSelfClosing ? ' /' : ''}>`;
  });

  // Normalize whitespace + drop "spacer" blocks that are essentially blank.
  // Getro frequently emits `<p><br /></p>` between real paragraphs, which
  // doubles vertical spacing once `prose` margins kick in. Iterate so that
  // nested wrappers (e.g. <div>< br /></div>) collapse too.
  let prev: string;
  do {
    prev = out;
    out = out
      // Collapse a block-level wrapper that contains only whitespace,
      // <br>, &nbsp; entities, or nested empty wrappers.
      .replace(
        /<(p|div|li|h[1-6]|blockquote)>\s*(?:<br\s*\/?>\s*|&nbsp;| |\s)*\s*<\/\1>/gi,
        '',
      );
  } while (out !== prev);

  // Collapse insignificant whitespace between block tags so the rendered
  // HTML doesn't accumulate stray newlines.
  out = out.replace(/>\s+</g, '><').trim();

  return out;
}

function escapeAttr(value: string): string {
  return value.replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]!));
}

// Plain-text extraction for short_description / search indexing
export function htmlToPlainText(input: string | null | undefined, maxChars = 280): string {
  if (!input) return '';
  let text = input
    .replace(/<\/(p|div|li|h[1-6]|br)\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > maxChars) {
    text = text.slice(0, maxChars - 1).trimEnd() + '…';
  }
  return text;
}
