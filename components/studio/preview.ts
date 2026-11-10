/*
 * Turns the project's frontend/ files into one document for a sandboxed
 * iframe. The frame has an opaque origin, so relative URLs don't resolve:
 * local stylesheets, scripts and SVGs are inlined, and a bootstrap script
 * defines window.studio (deployed contracts, chains, and an EIP-1193
 * provider that forwards to the builder's wallet over postMessage).
 */

export interface PreviewContract {
  name: string;
  address: string;
  chainId: number | null;
  network: string;
  abi: readonly unknown[];
  explorerUrl: string | null;
}

export interface PreviewContext {
  contracts: PreviewContract[];
  chains: Record<string, unknown>;
  files: { path: string; content: string }[];
  /** The design system, served as frontend/builder-hub.css unless the project has its own file there. */
  designCss?: string;
  /** Source of the `@studio/react` hooks, which React apps import; compiled in the browser like the app's own files. */
  studioReact?: string;
}

export const PREVIEW_ENTRY = 'frontend/index.html';
export const DESIGN_SYSTEM_PATH = 'frontend/builder-hub.css';

/** Token data the frame may ask Builder Hub for; answered by the Studio tokens route, never by a URL the frame names. */
export const PREVIEW_API_OPS = new Set(['tokenList', 'tokenBalances']);

/** Methods the frame may send to the wallet. Anything else is refused before it reaches the wallet. */
export const PREVIEW_RPC_METHODS = new Set([
  'eth_requestAccounts',
  'eth_accounts',
  'eth_chainId',
  'net_version',
  'eth_sendTransaction',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
  'wallet_watchAsset',
  'personal_sign',
  'eth_signTypedData_v4',
  'eth_call',
  'eth_estimateGas',
  'eth_getBalance',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getLogs',
  'eth_getCode',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
]);

const AVALANCHE_MARK =
  '<svg viewBox="22 20 178 155" width="14" height="12" aria-hidden="true" focusable="false">' +
  '<path fill="#E6212F" d="M109.139252,23.041748 C111.741776,24.518684 114.786873,25.521351 116.039948,27.602837 C123.769547,40.442513 131.114777,53.514198 138.545532,66.532860 C141.523560,71.750351 141.392197,76.930382 138.378067,82.178566 C122.784348,109.330147 107.212326,136.494400 91.727638,163.708237 C88.432472,169.499405 83.770172,172.296158 77.077980,172.237946 C62.580860,172.111847 48.081749,172.237732 33.583733,172.183975 C25.895014,172.155457 23.042721,167.395203 26.880989,160.673264 C49.344860,121.332367 71.899803,82.043488 94.420807,42.735210 C97.235901,37.821735 99.810646,32.750118 102.939713,28.046438 C104.299789,26.001934 106.781303,24.703455 109.139252,23.041748 z"/>' +
  '<path fill="#E6212F" d="M190.145935,151.838699 C192.156281,155.320618 194.133530,158.409164 195.809311,161.653442 C198.644424,167.142075 196.006195,172.076218 189.921402,172.129471 C171.131317,172.293900 152.337845,172.294647 133.547867,172.121841 C127.530586,172.066513 124.725456,166.870987 127.775551,161.592056 C136.920776,145.764069 146.170135,129.994598 155.552734,114.306282 C159.019684,108.509308 164.857819,108.843597 168.514145,114.968781 C175.755188,127.099236 182.832336,139.327515 190.145935,151.838699 z"/>' +
  '</svg>';

/** The footer every Studio-built app carries; the design system styles `.bh-built`. */
export const BUILT_FOOTER =
  `<footer class="bh-built">${AVALANCHE_MARK}<span>Built on ` +
  '<a href="https://build.avax.network/console/studio" target="_blank" rel="noopener">Builder Hub Studio</a>' +
  ' · Powered by Avalanche</span></footer>';

/** The same rules as builder-hub.css, for a page that doesn't link it. */
const BUILT_FOOTER_STYLE =
  '<style data-bh-built>body{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column}' +
  '.bh-built{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:auto;padding:16px 20px;' +
  'border-top:1px solid var(--bh-border,#e4e4e7);color:var(--bh-faint,#a1a1aa);font-family:var(--bh-font-mono,ui-monospace,monospace);' +
  'font-size:10.5px;letter-spacing:.08em;text-transform:uppercase}.bh-built a{color:var(--bh-muted,#71717a);text-decoration:none}' +
  '.bh-built a:hover{color:var(--bh-accent,#e6212f);text-decoration:underline}.bh-built svg{flex-shrink:0}</style>';

/** Adds the Studio footer to a page that doesn't already carry one. */
export function withBuiltFooter(html: string): string {
  if (/class\s*=\s*["'][^"']*\bbh-built\b/i.test(html)) return html;
  const block = `${BUILT_FOOTER_STYLE}\n${BUILT_FOOTER}`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}\n</body>`) : `${html}\n${block}`;
}

const isLocal = (url: string) => !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url.trim());

/** frontend/-relative path for a reference made from index.html. */
function resolve(ref: string): string | null {
  const parts: string[] = [];
  for (const segment of `frontend/${ref.trim().replace(/^\.\//, '').split(/[?#]/)[0]}`.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (parts.length <= 1) return null;
      parts.pop();
    } else parts.push(segment);
  }
  return parts.join('/');
}

/** Safe inside a <script> element: the HTML parser ends the element at the first `</script`. */
const scriptSafe = (code: string) => code.replace(/<\/script/gi, '<\\/script');
const styleSafe = (css: string) => css.replace(/<\/style/gi, '<\\/style');
const jsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function bootstrap(context: PreviewContext, channel: string, theme: 'light' | 'dark'): string {
  const contracts = Object.fromEntries(
    context.contracts.map((c) => [
      c.name,
      { address: c.address, abi: c.abi, chainId: c.chainId, network: c.network, explorerUrl: c.explorerUrl },
    ]),
  );
  return `<script>
(() => {
  const CHANNEL = ${jsonForScript(channel)};
  const contracts = ${jsonForScript(contracts)};
  const chains = ${jsonForScript(context.chains)};
  const pending = new Map();
  const stages = new Map();
  const listeners = {};
  let nextId = 1;
  document.documentElement.dataset.theme = ${jsonForScript(theme)};
  const post = (message) => window.parent.postMessage({ channel: CHANNEL, ...message }, '*');
  const call = (message) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    post({ ...message, id });
  });
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const m = event.data;
    if (!m || m.channel !== CHANNEL) return;
    if (m.type === 'rpc-result') {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      stages.delete(m.id);
      if (m.error) p.reject(Object.assign(new Error(m.error.message), { code: m.error.code, data: m.error.data }));
      else p.resolve(m.result);
    } else if (m.type === 'eerc-stage') {
      const fn = stages.get(m.id);
      if (fn) { try { fn(m.stage); } catch (e) { console.error(e); } }
    } else if (m.type === 'event') {
      for (const fn of listeners[m.event] || []) { try { fn(m.data); } catch (e) { console.error(e); } }
    } else if (m.type === 'theme' && (m.theme === 'light' || m.theme === 'dark')) {
      document.documentElement.dataset.theme = m.theme;
    }
  });
  const provider = {
    isStudio: true,
    request({ method, params } = {}) { return call({ type: 'rpc', method, params }); },
    on(event, fn) { (listeners[event] = listeners[event] || []).push(fn); return provider; },
    removeListener(event, fn) { listeners[event] = (listeners[event] || []).filter((f) => f !== fn); return provider; },
  };
  const explorer = Object.freeze({
    tokenList: (chainId) => call({ type: 'api', op: 'tokenList', args: { chainId: Number(chainId) } }),
    tokenBalances: (address, chainId) => call({ type: 'api', op: 'tokenBalances', args: { address: String(address), chainId: Number(chainId) } }),
  });
  // Encrypted ERC runs in Builder Hub's page, not here: the key it derives never enters the app.
  const eerc = (request, options) => {
    const id = nextId++;
    if (options && typeof options.onStage === 'function') stages.set(id, options.onStage);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      post({ type: 'eerc', id, request });
    });
  };
  window.studio = Object.freeze({ contracts, chains, provider, explorer, eerc });
  try { Object.defineProperty(window, 'ethereum', { value: provider, configurable: true }); } catch (e) {}
  const report = (message) => post({ type: 'error', message: String(message).slice(0, 2000) });
  window.addEventListener('error', (e) => report(e.message + (e.filename ? ' (' + e.lineno + ':' + e.colno + ')' : '')));
  window.addEventListener('unhandledrejection', (e) => report((e.reason && (e.reason.shortMessage || e.reason.message)) || e.reason));
})();
</script>`;
}

/** The document for the preview frame, or null when the project has no frontend/index.html. */
export function buildPreviewDocument(
  context: PreviewContext,
  channel: string,
  theme: 'light' | 'dark' = 'light',
): string | null {
  const files = new Map(context.files.map((f) => [f.path, f.content]));
  if (context.designCss && !files.has(DESIGN_SYSTEM_PATH)) files.set(DESIGN_SYSTEM_PATH, context.designCss);
  const entry = files.get(PREVIEW_ENTRY);
  if (entry === undefined) return null;

  let html = withBuiltFooter(entry)
    .replace(/<link\b[^>]*>/gi, (tag) => {
      if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      const path = href && isLocal(href) ? resolve(href) : null;
      const css = path ? files.get(path) : undefined;
      return css === undefined ? tag : `<style data-src="${path}">\n${styleSafe(css)}\n</style>`;
    })
    .replace(/<script\b([^>]*)>\s*<\/script>/gi, (tag, attrs: string) => {
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      const path = src && isLocal(src) ? resolve(src) : null;
      const code = path ? files.get(path) : undefined;
      if (code === undefined) return tag;
      const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      return `<script${type ? ` type="${type}"` : ''} data-src="${path}">\n${scriptSafe(code)}\n</script>`;
    })
    .replace(/\b(src|href)\s*=\s*["']([^"']+\.svg)["']/gi, (match, attr: string, ref: string) => {
      const path = isLocal(ref) ? resolve(ref) : null;
      const svg = path ? files.get(path) : undefined;
      return svg === undefined ? match : `${attr}="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"`;
    });

  const boot = bootstrap(context, channel, theme);
  if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, (head) => `${head}\n${boot}`);
  else if (/<html\b[^>]*>/i.test(html)) html = html.replace(/<html\b[^>]*>/i, (tag) => `${tag}\n<head>${boot}</head>`);
  else html = `${boot}\n${html}`;
  return html;
}
