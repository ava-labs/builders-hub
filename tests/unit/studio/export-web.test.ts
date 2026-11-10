import { describe, expect, it } from 'vitest';
import { parseIndexHtml, webAppFiles } from '@/lib/studio/export-web';

const PAGE = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title> Mon  app </title>
<link rel="stylesheet" href="builder-hub.css"><link rel="stylesheet" href="./styles.css">
<link rel="stylesheet" href="https://cdn.example/x.css"><link rel="icon" href="favicon.ico">
<style>.head{color:red}</style></head>
<body><main><img src="./img/logo.svg"><a href="https://avax.network">a</a><a href="#top">top</a>
<img src='assets/b.png'></main>
<!-- <script src="commented.js"></script> -->
<script type="module" src="app.js"></script>
<script>window.boot = 1</script>
<script src="https://cdn.example/lib.js"></script></body></html>`;

describe('parseIndexHtml', () => {
  it('keeps the page language and title, and the stylesheets in document order', () => {
    const page = parseIndexHtml(PAGE);
    expect(page.lang).toBe('fr');
    expect(page.title).toBe('Mon app');
    expect(page.styles).toEqual(['/app/builder-hub.css', '/app/styles.css', 'https://cdn.example/x.css']);
  });

  it('takes scripts out of the markup and keeps their order, inline ones included, ignoring commented ones', () => {
    const page = parseIndexHtml(PAGE);
    expect(page.scripts).toEqual([
      { src: '/app/app.js', type: 'module' },
      { code: 'window.boot = 1' },
      { src: 'https://cdn.example/lib.js' },
    ]);
    expect(page.body).not.toContain('<script');
    expect(page.body).not.toContain('commented.js');
  });

  it('points relative assets at /app and leaves remote and anchor links alone', () => {
    const { body } = parseIndexHtml(PAGE);
    expect(body).toContain('src="/app/img/logo.svg"');
    expect(body).toContain("src='/app/assets/b.png'");
    expect(body).toContain('href="https://avax.network"');
    expect(body).toContain('href="#top"');
    expect(body).toContain('.head{color:red}');
  });

  it('will not serve a path that climbs out of the frontend folder', () => {
    const { body } = parseIndexHtml('<body><img src="../../contracts/Secret.sol"></body>');
    expect(body).toContain('src="../../contracts/Secret.sol"');
    expect(body).not.toContain('/app/');
  });
});

describe('webAppFiles', () => {
  const input = {
    name: 'demo-web',
    title: 'Demo',
    files: [
      { path: 'frontend/index.html', content: PAGE },
      { path: 'frontend/app.js', content: 'export {}' },
      { path: 'frontend/styles.css', content: '.a{}' },
    ],
    designCss: '.bh-page{}',
    withFooter: (html: string) => html.replace('</body>', '<footer class="bh-built">x</footer></body>'),
    config: { contracts: {}, chains: {}, tokens: {} },
  };
  const byPath = (files: { path: string; data: string }[]) => Object.fromEntries(files.map((f) => [f.path, f.data]));

  it('builds a Next.js app with the wallet layer, the page and the project files', () => {
    const files = byPath(webAppFiles(input));
    for (const path of [
      'package.json',
      'app/page.tsx',
      'app/providers.tsx',
      'lib/wagmi.ts',
      'lib/studio-runtime.ts',
      'lib/studio.config.ts',
      'lib/app-content.ts',
      'public/app/app.js',
      'public/app/styles.css',
      'public/app/builder-hub.css',
      'tsconfig.json',
      '.gitignore',
      '.env.example',
    ]) {
      expect(files[path], path).toBeDefined();
    }
    expect(files['public/app/builder-hub.css']).toBe('.bh-page{}');
    expect(files['lib/app-content.ts']).toContain('class=\\"bh-built\\"');
    expect(files['lib/studio.config.ts']).toContain('"title": "Demo"');
  });

  it('pins a wagmi that RainbowKit installs with, and fills every version', () => {
    const pkg = JSON.parse(byPath(webAppFiles(input))['package.json']);
    expect(pkg.name).toBe('demo-web');
    expect(pkg.dependencies.wagmi).toMatch(/^\^2\./);
    expect(pkg.dependencies['@rainbow-me/rainbowkit']).toMatch(/^\^2\./);
    expect(JSON.stringify(pkg)).not.toContain('__');
  });

  it('puts the design system first, unless the project ships its own builder-hub.css', () => {
    const plain = byPath(
      webAppFiles({ ...input, files: [{ path: 'frontend/index.html', content: '<body>x</body>' }] }),
    );
    expect(plain['lib/app-content.ts']).toContain('"/app/builder-hub.css"');
    const own = byPath(
      webAppFiles({
        ...input,
        files: [...input.files, { path: 'frontend/builder-hub.css', content: '.mine{}' }],
      }),
    );
    expect(own['public/app/builder-hub.css']).toBe('.mine{}');
  });

  it('exports nothing without frontend/index.html', () => {
    expect(webAppFiles({ ...input, files: [{ path: 'frontend/app.js', content: '' }] })).toEqual([]);
  });
});

describe('webAppFiles for a React app', () => {
  const react = {
    name: 'demo-web',
    title: 'Demo',
    files: [
      { path: 'frontend/App.jsx', content: 'export default function App() { return null; }' },
      { path: 'frontend/components/Card.jsx', content: 'export default () => null;' },
      { path: 'frontend/styles.css', content: '.a{}' },
    ],
    designCss: '.bh-page{}',
    withFooter: (html: string) => html,
    config: { contracts: {}, chains: {}, tokens: {} },
  };
  const byPath = (files: { path: string; data: string }[]) => Object.fromEntries(files.map((f) => [f.path, f.data]));

  it('exports the components as source, with the hooks and wallet layer around them', () => {
    const files = byPath(webAppFiles(react));
    expect(files['frontend/App.jsx']).toContain('export default function App');
    expect(files['frontend/components/Card.jsx']).toBeDefined();
    expect(files['frontend/builder-hub.css']).toBe('.bh-page{}');
    for (const path of ['lib/studio-react.ts', 'components/StudioRoot.tsx', 'lib/wagmi.ts', 'app/providers.tsx']) {
      expect(files[path], path).toBeDefined();
    }
    // The HTML-mount files of the older export are not part of a React project.
    expect(files['components/StudioApp.tsx']).toBeUndefined();
    expect(files['lib/app-content.ts']).toBeUndefined();
    expect(files['public/app/app.js']).toBeUndefined();
  });

  it('imports the design system before the app styles, and mounts App inside the wallet root', () => {
    const files = byPath(webAppFiles(react));
    const layout = files['app/layout.tsx'];
    expect(layout.indexOf("'../frontend/builder-hub.css'")).toBeGreaterThan(-1);
    expect(layout.indexOf("'../frontend/builder-hub.css'")).toBeLessThan(layout.indexOf("'../frontend/styles.css'"));
    expect(files['app/page.tsx']).toContain("import App from '../frontend/App.jsx';");
    expect(files['app/page.tsx']).toContain('<StudioRoot>');
  });

  it('imports a named App export when the file has no default one', () => {
    const files = byPath(
      webAppFiles({
        ...react,
        files: [{ path: 'frontend/App.jsx', content: 'export function App() { return null; }' }],
      }),
    );
    expect(files['app/page.tsx']).toContain("import { App } from '../frontend/App.jsx';");
  });

  it('resolves @studio/react to the hooks file and allows the app as JavaScript', () => {
    const tsconfig = JSON.parse(byPath(webAppFiles(react))['tsconfig.json']);
    expect(tsconfig.compilerOptions.paths['@studio/react']).toEqual(['./lib/studio-react.ts']);
    expect(tsconfig.compilerOptions.allowJs).toBe(true);
  });
});

describe('webAppFiles with Encrypted ERC', () => {
  const base = {
    name: 'priv-web',
    title: 'Private',
    designCss: '.bh-page{}',
    withFooter: (html: string) => html,
    config: { contracts: {}, chains: {}, tokens: {} },
  };
  const byPath = (files: { path: string; data: string }[]) => Object.fromEntries(files.map((f) => [f.path, f.data]));

  it('ships the eERC client, its ABIs and its packages when the app uses useEERC', () => {
    const files = byPath(
      webAppFiles({
        ...base,
        files: [
          { path: 'frontend/App.jsx', content: "import { useEERC } from '@studio/react'; export default () => null;" },
        ],
      }),
    );
    for (const path of [
      'lib/studio-eerc.ts',
      'lib/eerc/client.ts',
      'lib/eerc/operations/mint.ts',
      'lib/eerc/crypto/poseidon/poseidon.ts',
      'types/eerc-modules.d.ts',
      'contracts/encrypted-erc/compiled/EncryptedERC.json',
    ]) {
      expect(files[path], path).toBeDefined();
    }
    expect(Object.keys(JSON.parse(files['contracts/encrypted-erc/compiled/EncryptedERC.json']))).toEqual(['abi']);
    expect(files['lib/studio-eerc.ts']).toContain('https://build.avax.network/eerc/circuits');
    const pkg = JSON.parse(files['package.json']);
    expect(pkg.dependencies.snarkjs).toBeDefined();
    expect(pkg.dependencies['poseidon-lite']).toBeDefined();
    expect(JSON.parse(files['tsconfig.json']).compilerOptions.paths['@/*']).toEqual(['./*']);
  });

  it('leaves the eERC client out of apps that do not use it', () => {
    const files = byPath(
      webAppFiles({ ...base, files: [{ path: 'frontend/App.jsx', content: 'export default () => null;' }] }),
    );
    expect(files['lib/eerc/client.ts']).toBeUndefined();
    expect(files['lib/studio-eerc.ts']).toContain('without Encrypted ERC support');
    expect(JSON.parse(files['package.json']).dependencies.snarkjs).toBeUndefined();
    expect(JSON.parse(files['tsconfig.json']).compilerOptions.paths['@/*']).toBeUndefined();
  });
});
