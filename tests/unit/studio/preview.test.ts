import { describe, expect, it } from 'vitest';
import {
  PREVIEW_RPC_METHODS,
  buildPreviewDocument,
  withBuiltFooter,
  type PreviewContext,
} from '@/components/studio/preview';
import { STUDIO_FILE_PATH } from '@/types/studio';

const context = (files: PreviewContext['files']): PreviewContext => ({
  contracts: [
    {
      name: 'Guestbook',
      address: '0x1111111111111111111111111111111111111111',
      chainId: 43113,
      network: 'fuji-c-chain',
      abi: [{ type: 'function', name: 'sign', inputs: [], outputs: [], stateMutability: 'nonpayable' }],
      explorerUrl: null,
    },
  ],
  chains: { 43113: { name: 'Avalanche Fuji C-Chain' } },
  files,
});

const INDEX = `<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head>
<body><img src="./logo.svg"><script type="module" src="app.js"></script></body></html>`;

describe('buildPreviewDocument', () => {
  it('inlines local styles, scripts and SVGs, and defines window.studio before them', () => {
    const doc = buildPreviewDocument(
      context([
        { path: 'frontend/index.html', content: INDEX },
        { path: 'frontend/styles.css', content: 'body { color: red }' },
        { path: 'frontend/app.js', content: 'console.log(window.studio.contracts.Guestbook.address)' },
        { path: 'frontend/logo.svg', content: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
      ]),
      'chan-1',
    )!;
    expect(doc).toContain('<style data-src="frontend/styles.css">');
    expect(doc).toContain('body { color: red }');
    expect(doc).toContain('<script type="module" data-src="frontend/app.js">');
    expect(doc).toContain('src="data:image/svg+xml;charset=utf-8,');
    expect(doc).not.toContain('href="styles.css"');
    expect(doc.indexOf('window.studio = Object.freeze')).toBeLessThan(doc.indexOf('data-src="frontend/app.js"'));
    expect(doc).toContain('"chan-1"');
    expect(doc).toContain('0x1111111111111111111111111111111111111111');
  });

  it("can't be broken out of by a script or a contract name that closes the tag", () => {
    const doc = buildPreviewDocument(
      {
        ...context([
          {
            path: 'frontend/index.html',
            content: '<html><head></head><body><script src="app.js"></script></body></html>',
          },
          { path: 'frontend/app.js', content: 'const s = "</script><img src=x onerror=alert(1)>";' },
        ]),
        contracts: [{ ...context([]).contracts[0], name: '</script><b>x' }],
      },
      'c',
    )!;
    expect(doc).not.toContain('"</script><img');
    expect(doc).toContain('<\\/script><img');
    expect(doc).not.toContain('"</script><b>x"');
  });

  it('leaves remote URLs alone and refuses paths that climb out of frontend/', () => {
    const doc = buildPreviewDocument(
      context([
        {
          path: 'frontend/index.html',
          content:
            '<head><link rel="stylesheet" href="https://cdn.example/x.css"><link rel="stylesheet" href="../../contracts/Secret.sol"></head>',
        },
      ]),
      'c',
    )!;
    expect(doc).toContain('href="https://cdn.example/x.css"');
    expect(doc).toContain('href="../../contracts/Secret.sol"');
  });

  it('serves the design system as builder-hub.css, sets the theme, and exposes the token calls', () => {
    const doc = buildPreviewDocument(
      {
        ...context([
          {
            path: 'frontend/index.html',
            content: '<html><head><link rel="stylesheet" href="builder-hub.css"></head><body></body></html>',
          },
        ]),
        designCss: '.bh-board { border: 1px solid var(--bh-border); }',
      },
      'c',
      'dark',
    )!;
    expect(doc).toContain('<style data-src="frontend/builder-hub.css">');
    expect(doc).toContain('.bh-board { border: 1px solid var(--bh-border); }');
    expect(doc).toContain('document.documentElement.dataset.theme = "dark"');
    expect(doc).toContain("op: 'tokenBalances'");
    expect(doc).toContain('window.studio = Object.freeze({ contracts, chains, provider, explorer, eerc })');
  });

  it("keeps the project's own builder-hub.css when it has one", () => {
    const doc = buildPreviewDocument(
      {
        ...context([
          { path: 'frontend/index.html', content: '<head><link rel="stylesheet" href="builder-hub.css"></head>' },
          { path: 'frontend/builder-hub.css', content: '.mine {}' },
        ]),
        designCss: '.shared {}',
      },
      'c',
    )!;
    expect(doc).toContain('.mine {}');
    expect(doc).not.toContain('.shared {}');
  });

  it('ends every app with the Built on Builder Hub Studio footer, once', () => {
    const doc = buildPreviewDocument(
      context([{ path: 'frontend/index.html', content: '<html><head></head><body><main>App</main></body></html>' }]),
      'c',
    )!;
    expect(doc).toContain('class="bh-built"');
    expect(doc).toContain('Builder Hub Studio');
    expect(doc.indexOf('class="bh-built"')).toBeGreaterThan(doc.indexOf('<main>App</main>'));
    expect(doc.indexOf('class="bh-built"')).toBeLessThan(doc.indexOf('</body>'));

    const own = '<body><footer class="bh-built">custom</footer></body>';
    expect(withBuiltFooter(own)).toBe(own);
  });

  it('has nothing to show without frontend/index.html', () => {
    expect(buildPreviewDocument(context([{ path: 'frontend/app.js', content: '' }]), 'c')).toBeNull();
  });

  it('never lets the frame ask the wallet for keys or arbitrary signing', () => {
    expect(PREVIEW_RPC_METHODS.has('eth_sendTransaction')).toBe(true);
    for (const method of ['eth_sign', 'eth_signTransaction', 'wallet_requestPermissions', 'eth_sendRawTransaction']) {
      expect(PREVIEW_RPC_METHODS.has(method)).toBe(false);
    }
  });
});

describe('frontend files', () => {
  it('are stored under frontend/ as web files, and nowhere else', () => {
    for (const ok of [
      'frontend/index.html',
      'frontend/app.js',
      'frontend/styles.css',
      'frontend/assets/logo.svg',
      'contracts/A.sol',
    ]) {
      expect(STUDIO_FILE_PATH.test(ok)).toBe(true);
    }
    for (const bad of ['frontend/app.ts', 'contracts/app.js', 'frontend/.env', 'frontend/../x.js', 'docs/page.html']) {
      expect(STUDIO_FILE_PATH.test(bad)).toBe(false);
    }
  });
});
