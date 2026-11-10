import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PreviewContext } from '@/components/studio/preview';
import { buildAppDocument, buildReactDocument, externalUrl } from '@/components/studio/preview-react';

const HOOKS = fs.readFileSync('templates/studio-web/lib/studio-react.ts', 'utf8');

const context = (files: PreviewContext['files']): PreviewContext => ({
  contracts: [],
  chains: {},
  files,
  designCss: '.bh-page{}',
  studioReact: HOOKS,
});

/** The data the frame's loader reads, back out of the document. */
function loaderData(doc: string) {
  const json = /window\.__studioApp = (\{[\s\S]*?\});\s*<\/script>/.exec(doc)?.[1];
  return JSON.parse(json!) as {
    MODULES: Record<string, string>;
    EXTERNALS: Record<string, string>;
    UNSUPPORTED: string[];
    ENTRY: string;
  };
}

const APP = `import { useState } from 'react';
import { useWallet } from '@studio/react';
import Card from './components/Card.jsx';
export default function App() { const [n] = useState(0); const w = useWallet(); return <Card n={n}>{String(w.isConnected)}</Card>; }`;
const CARD = `import { formatUnits } from 'viem';
export default function Card({ n, children }) { return <p>{formatUnits(1n, 0)}{n}{children}</p>; }`;

describe('buildReactDocument', () => {
  it('compiles the JSX files and the hooks, and lists the packages the frame must load', async () => {
    const doc = await buildReactDocument(
      context([
        { path: 'frontend/App.jsx', content: APP },
        { path: 'frontend/components/Card.jsx', content: CARD },
        { path: 'frontend/styles.css', content: '.mine{color:red}' },
      ]),
      'chan',
      'dark',
    );
    const data = loaderData(doc);
    expect(Object.keys(data.MODULES).sort()).toEqual(['@studio/react', 'App.jsx', 'components/Card.jsx']);
    // JSX became calls, and imports became requires the loader can answer.
    expect(data.MODULES['App.jsx']).toMatch(/require\(["']\.\/components\/Card\.jsx["']\)/);
    expect(data.MODULES['App.jsx']).toContain('jsx-runtime');
    expect(data.MODULES['App.jsx']).not.toContain('<Card');
    // The hooks file is TypeScript; none of its types may survive compilation.
    expect(data.MODULES['@studio/react']).not.toContain('interface ');
    expect(Object.keys(data.EXTERNALS).sort()).toEqual(['react', 'react-dom/client', 'react/jsx-runtime', 'viem']);
    expect(data.UNSUPPORTED).toEqual([]);
    expect(doc).toContain('<div id="root"></div>');
    expect(doc).toContain('.mine{color:red}');
    expect(doc).toContain('.bh-page{}');
    expect(doc).toContain('class="bh-built"');
    expect(doc.indexOf('.bh-page{}')).toBeLessThan(doc.indexOf('.mine{color:red}'));
    expect(doc).toContain('document.documentElement.dataset.theme = "dark"');
  });

  it('names a package the preview does not offer instead of failing quietly', async () => {
    const doc = await buildReactDocument(
      context([
        { path: 'frontend/App.jsx', content: "import confetti from 'canvas-confetti';\nexport default () => null;" },
      ]),
      'chan',
    );
    expect(loaderData(doc).UNSUPPORTED).toEqual(['canvas-confetti']);
  });

  it('reports a file that does not compile, with its name, and still builds the rest', async () => {
    const doc = await buildReactDocument(
      context([
        { path: 'frontend/App.jsx', content: APP },
        { path: 'frontend/components/Card.jsx', content: 'export default function Card() { return <div>; }' },
      ]),
      'chan',
    );
    expect(doc).toContain('frontend/components/Card.jsx:');
    expect(Object.keys(loaderData(doc).MODULES)).toContain('App.jsx');
  });

  it("can't be broken out of by markup in an app's source", async () => {
    const doc = await buildReactDocument(
      context([
        { path: 'frontend/App.jsx', content: 'export default () => <p>{"</script><img src=x onerror=alert(1)>"}</p>;' },
      ]),
      'chan',
    );
    expect(doc).not.toContain('"</script><img');
  });
});

describe('externalUrl', () => {
  it('offers react, react-dom, viem and nothing else', () => {
    expect(externalUrl('react')).toMatch(/^https:\/\/esm\.sh\/react@19\./);
    expect(externalUrl('react-dom/client')).toContain('deps=react@');
    expect(externalUrl('viem/chains')).toMatch(/viem@[\d.]+\/chains$/);
    for (const other of ['lodash', 'wagmi', 'viem/../evil', 'react-router', 'https://evil.example/x.js']) {
      expect(externalUrl(other)).toBeNull();
    }
  });
});

describe('buildAppDocument', () => {
  it('builds a React app when there is an App.jsx, and the older HTML page otherwise', async () => {
    const react = await buildAppDocument(context([{ path: 'frontend/App.jsx', content: APP }]), 'c');
    expect(react).toContain('__studioApp');
    const html = await buildAppDocument(
      context([{ path: 'frontend/index.html', content: '<html><head></head><body><main>Old</main></body></html>' }]),
      'c',
    );
    expect(html).toContain('<main>Old</main>');
    expect(html).not.toContain('__studioApp');
    expect(await buildAppDocument(context([{ path: 'frontend/app.js', content: '' }]), 'c')).toBeNull();
  });
});
