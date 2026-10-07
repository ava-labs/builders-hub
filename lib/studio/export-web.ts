import fs from 'node:fs';
import path from 'node:path';
import { REACT_ENTRY } from '@/components/studio/preview-react';
import type { AppScript, StudioConfig } from '@/templates/studio-web/lib/studio-types';

/*
 * The project's frontend/ as a Next.js app that deploys anywhere Next does
 * (Vercel, Netlify, Cloudflare, a Node server), with wagmi and RainbowKit
 * providing the wallet. A React app (frontend/App.jsx) is exported as real
 * components, using the same @studio/react hooks it had in the preview. An
 * HTML app from before React became the default is mounted in the page as it
 * is, served from public/app, talking to the same `window.studio`.
 */

const TEMPLATE_DIR = 'templates/studio-web';
const APP_DIR = 'public/app';
const INDEX = 'frontend/index.html';

/** Files copied as they are, into the same path in the exported app. */
const STATIC_FILES = [
  'app/icon.svg',
  'app/layout.tsx',
  'app/page.tsx',
  'app/providers.tsx',
  'components/StudioApp.tsx',
  'lib/studio-types.ts',
  'lib/studio-runtime.ts',
  'lib/tokens.ts',
  'lib/wagmi.ts',
  'next.config.mjs',
];

/** Template files that carry a `.tpl` suffix so they don't act as config inside this repository. */
const RENAMED_FILES: Record<string, string> = {
  'gitignore.tpl': '.gitignore',
  'env.example.tpl': '.env.example',
};

const isRemote = (url: string) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(url.trim());

/** `frontend/`-relative URL as served from /app. Null for anything that isn't a plain relative file. */
function servedPath(ref: string): string | null {
  const clean = ref.trim().replace(/^\.\//, '');
  if (!clean || isRemote(clean) || clean.startsWith('#') || clean.startsWith('/') || clean.startsWith('data:'))
    return null;
  const parts: string[] = [];
  for (const segment of clean.split(/[?#]/)[0].split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(segment);
  }
  return parts.length ? `/app/${parts.join('/')}` : null;
}

export interface ParsedApp {
  lang: string;
  title: string;
  /** Stylesheet URLs in document order: served files as /app/..., remote ones unchanged. */
  styles: string[];
  /** The markup between <body> tags, without scripts, with relative asset URLs pointing at /app. */
  body: string;
  /** Scripts in document order. */
  scripts: AppScript[];
}

/** Splits the Studio page into what the Next app needs: its styles, markup and scripts, in the order they ran. */
export function parseIndexHtml(html: string): ParsedApp {
  const lang = /<html\b[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ?? 'en';
  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/\s+/g, ' ').trim() || 'App';

  const styles: string[] = [];
  const scripts: AppScript[] = [];
  // Scripts, then the markup, in one pass over the document so their order is the page's order.
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<link\b[^>]*>/gi, (tag) => {
      if (!/\brel\s*=\s*["']?stylesheet/i.test(tag)) return '';
      const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (href) styles.push(isRemote(href) ? href : (servedPath(href) ?? href));
      return '';
    })
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_tag, attrs: string, code: string) => {
      const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (src) scripts.push({ src: isRemote(src) ? src : (servedPath(src) ?? src), ...(type ? { type } : {}) });
      else if (code.trim()) scripts.push({ code, ...(type ? { type } : {}) });
      return '';
    });

  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(stripped);
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(stripped)?.[1] ?? '';
  // Inline <style> blocks stay with the markup; the rest of <head> (meta, title) is handled by the layout.
  const headStyles = head.match(/<style\b[\s\S]*?<\/style>/gi)?.join('\n') ?? '';
  const markup = bodyMatch
    ? bodyMatch[1]
    : stripped
        .replace(/<!doctype[^>]*>/i, '')
        .replace(/<\/?html\b[^>]*>/gi, '')
        .replace(/<head\b[\s\S]*?<\/head>/i, '');

  const body = `${headStyles}\n${markup}`
    .replace(/\b(src|href|poster)\s*=\s*"([^"]+)"/gi, (m, attr: string, url: string) => {
      const served = servedPath(url);
      return served ? `${attr}="${served}"` : m;
    })
    .replace(/\b(src|href|poster)\s*=\s*'([^']+)'/gi, (m, attr: string, url: string) => {
      const served = servedPath(url);
      return served ? `${attr}='${served}'` : m;
    })
    .trim();

  return { lang, title, styles, body, scripts };
}

function readTemplate(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), TEMPLATE_DIR, rel), 'utf8');
}

/**
 * RainbowKit 2.x declares wagmi ^2.9 as a peer, so a plain `npm install` of the export only resolves with wagmi 2.
 * This site runs wagmi 3 (its package manager ignores the mismatch), which would not install for someone else.
 */
const WAGMI_FOR_RAINBOWKIT = '^2.19.5';

/** The versions this site itself runs, so the exported app uses a combination that is known to work together. */
function packageJson(name: string, eerc = false): string {
  const repo = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const v = (pkg: string) => repo.dependencies[pkg] ?? repo.devDependencies[pkg] ?? 'latest';
  return readTemplate('package.json.tpl')
    .replace('__NAME__', name)
    .replace('__RAINBOWKIT__', v('@rainbow-me/rainbowkit'))
    .replace('__REACT_QUERY__', v('@tanstack/react-query'))
    .replace('__NEXT__', v('next'))
    .replace('__REACT_DOM__', v('react-dom'))
    .replace('__REACT__', v('react'))
    .replace('__VIEM__', v('viem'))
    .replace('__WAGMI__', WAGMI_FOR_RAINBOWKIT)
    .replace('__TYPES_NODE__', v('@types/node'))
    .replace('__TYPES_REACT_DOM__', v('@types/react-dom'))
    .replace('__TYPES_REACT__', v('@types/react'))
    .replace('__TYPESCRIPT__', v('typescript'))
    .replace(/("dependencies": \{)/, (open) =>
      eerc
        ? `${open}\n${Object.entries(EERC_PACKAGES)
            .map(([pkg, version]) => `    "${pkg}": "${version}",`)
            .join('\n')}`
        : open,
    );
}

/** True when the app uses Encrypted ERC, so the export needs the eERC client and its dependencies. */
export const usesEERC = (files: { content: string }[]) =>
  files.some((f) => /\buseEERC\b|studio\.eerc\b/.test(f.content));

/** The eERC client and what it imports, copied from this repository under the same paths (`@/*` maps to the app root). */
const EERC_SOURCES = [
  'lib/eerc/client.ts',
  'lib/eerc/identity.ts',
  'lib/eerc/identityValidation.ts',
  'lib/eerc/balanceValidation.ts',
  'lib/eerc/proof.ts',
  'lib/eerc/register.ts',
  'lib/eerc/types.ts',
  'lib/eerc/operations/deposit.ts',
  'lib/eerc/operations/transfer.ts',
  'lib/eerc/operations/withdraw.ts',
  'lib/eerc/operations/mint.ts',
  'lib/eerc/crypto/index.ts',
  'lib/eerc/crypto/babyjub.ts',
  'lib/eerc/crypto/constants.ts',
  'lib/eerc/crypto/ff.ts',
  'lib/eerc/crypto/key.ts',
  'lib/eerc/crypto/scalar.ts',
  'lib/eerc/crypto/poseidon/poseidon.ts',
  'lib/eerc/crypto/poseidon/constants.ts',
  'types/eerc-modules.d.ts',
];
const EERC_ARTIFACTS = [
  'contracts/encrypted-erc/compiled/EncryptedERC.json',
  'contracts/encrypted-erc/compiled/Registrar.json',
];
/** The versions this site proves with; the client was written and tested against them. */
const EERC_PACKAGES: Record<string, string> = {
  'blake-hash': '^2.0.0',
  buffer: '^6.0.3',
  'js-sha256': '^0.11.1',
  'poseidon-lite': '^0.3.0',
  snarkjs: '^0.7.5',
};

const EERC_STUB = `import type { StudioConfig } from './studio-types';

// This app doesn't use Encrypted ERC; Builder Hub Studio adds the eERC client when an app calls useEERC.
export function createEERC(_: { provider: unknown; contracts: StudioConfig['contracts']; chains: StudioConfig['chains'] }) {
  return async (): Promise<never> => {
    throw new Error('This app was exported without Encrypted ERC support.');
  };
}
`;

const readRepo = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/** studio-eerc.ts, the eERC client when the app uses it, and the tsconfig and package.json that go with them. */
function eercFiles(eerc: boolean): { path: string; data: string }[] {
  if (!eerc) return [{ path: 'lib/studio-eerc.ts', data: EERC_STUB }];
  return [
    { path: 'lib/studio-eerc.ts', data: readTemplate('lib/studio-eerc.ts') },
    ...EERC_SOURCES.map((rel) => ({ path: rel, data: readRepo(rel) })),
    // Only the ABIs: the app calls these contracts, it never deploys them.
    ...EERC_ARTIFACTS.map((rel) => ({ path: rel, data: JSON.stringify({ abi: JSON.parse(readRepo(rel)).abi }) })),
  ];
}

function tsconfig(eerc: boolean): string {
  const config = JSON.parse(readTemplate('tsconfig.json.tpl')) as {
    compilerOptions: { paths: Record<string, string[]> };
  };
  if (eerc) config.compilerOptions.paths['@/*'] = ['./*'];
  return `${JSON.stringify(config, null, 2)}\n`;
}

export interface WebAppInput {
  /** Package and site name, lowercase with dashes. */
  name: string;
  title: string;
  /** The project's frontend/ files. */
  files: { path: string; content: string }[];
  designCss: string;
  config: Omit<StudioConfig, 'title'>;
  /** Adds the "Built on Builder Hub Studio" footer to the page's markup. */
  withFooter: (html: string) => string;
}

/** Files of a React app's Next project that are the same for every project. */
const REACT_STATIC_FILES = [
  'app/icon.svg',
  'app/providers.tsx',
  'components/StudioRoot.tsx',
  'lib/studio-types.ts',
  'lib/studio-runtime.ts',
  'lib/studio-react.ts',
  'lib/tokens.ts',
  'lib/wagmi.ts',
  'next.config.mjs',
];

const configModule = (input: WebAppInput) =>
  "import type { StudioConfig } from './studio-types';\n\n// Written by Builder Hub Studio: the contracts and chains this app was built against.\n" +
  `export const studioConfig: StudioConfig = ${JSON.stringify({ title: input.title, ...input.config }, null, 2)};\n`;

/**
 * A React app (frontend/App.jsx and the components it imports) as real source in the Next project: `frontend/` holds
 * the components, `@studio/react` resolves to the hooks in lib/, and the layout imports the styles.
 */
function reactAppFiles(input: WebAppInput): { path: string; data: string }[] {
  const source = new Map(input.files.map((f) => [f.path.slice('frontend/'.length), f.content]));
  if (!source.has('builder-hub.css')) source.set('builder-hub.css', input.designCss);
  // The design system first: the app's own styles build on it.
  const styles = [...source.keys()]
    .filter((rel) => rel.endsWith('.css'))
    .sort((a, b) => (a === 'builder-hub.css' ? -1 : b === 'builder-hub.css' ? 1 : a.localeCompare(b)));
  const importsApp = /export\s+default\b/.test(source.get('App.jsx') ?? '')
    ? "import App from '../frontend/App.jsx';"
    : "import { App } from '../frontend/App.jsx';";

  const layout = `import type { Metadata } from 'next';
import type { ReactNode } from 'react';
${styles.map((rel) => `import '../frontend/${rel}';`).join('\n')}
import { Providers } from './providers';

export const metadata: Metadata = { title: ${JSON.stringify(input.title)} };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`;
  const page = `'use client';

import { StudioRoot } from '../components/StudioRoot';
${importsApp}

export default function Page() {
  return (
    <StudioRoot>
      <App />
    </StudioRoot>
  );
}
`;

  const eerc = usesEERC(input.files);
  return [
    ...REACT_STATIC_FILES.map((rel) => ({ path: rel, data: readTemplate(rel) })),
    ...Object.entries(RENAMED_FILES).map(([from, to]) => ({ path: to, data: readTemplate(from) })),
    { path: 'tsconfig.json', data: tsconfig(eerc) },
    ...eercFiles(eerc),
    { path: 'package.json', data: packageJson(input.name, eerc) },
    { path: 'app/layout.tsx', data: layout },
    { path: 'app/page.tsx', data: page },
    { path: 'lib/studio.config.ts', data: configModule(input) },
    ...[...source].map(([rel, content]) => ({ path: `frontend/${rel}`, data: content })),
  ];
}

/**
 * Every file of the Next app, with paths relative to its folder. Empty when the project has no frontend.
 * A React app (frontend/App.jsx) becomes real components; an older HTML app (frontend/index.html) is mounted as it is.
 */
export function webAppFiles(input: WebAppInput): { path: string; data: string }[] {
  if (input.files.some((f) => f.path === REACT_ENTRY)) return reactAppFiles(input);
  const index = input.files.find((f) => f.path === INDEX);
  if (!index) return [];
  const page = parseIndexHtml(input.withFooter(index.content));

  const styles = [...page.styles];
  const served = new Map<string, string>();
  for (const f of input.files) {
    if (f.path === INDEX) continue;
    served.set(f.path.slice('frontend/'.length), f.content);
  }
  if (!served.has('builder-hub.css')) {
    served.set('builder-hub.css', input.designCss);
    // The design system comes first: the page's own styles build on it.
    if (!styles.includes('/app/builder-hub.css')) styles.unshift('/app/builder-hub.css');
  }

  const module = (name: string, value: unknown, type: string) =>
    `export const ${name}${type ? `: ${type}` : ''} = ${JSON.stringify(value, null, 2)};\n`;

  const eerc = usesEERC(input.files);
  return [
    ...STATIC_FILES.map((rel) => ({ path: rel, data: readTemplate(rel) })),
    ...Object.entries(RENAMED_FILES).map(([from, to]) => ({ path: to, data: readTemplate(from) })),
    { path: 'tsconfig.json', data: tsconfig(eerc) },
    ...eercFiles(eerc),
    { path: 'package.json', data: packageJson(input.name, eerc) },
    { path: 'lib/studio.config.ts', data: configModule(input) },
    {
      path: 'lib/app-content.ts',
      data:
        "import type { AppScript } from './studio-types';\n\n// Written by Builder Hub Studio: the page your Studio frontend was built as (public/app holds its files).\n" +
        module('APP_LANG', page.lang, '') +
        module('APP_TITLE', page.title, '') +
        module('APP_STYLES', styles, 'string[]') +
        module('APP_BODY', page.body, '') +
        module('APP_SCRIPTS', page.scripts, 'AppScript[]'),
    },
    ...[...served].map(([rel, content]) => ({ path: `${APP_DIR}/${rel}`, data: content })),
  ];
}

export const webReadme = (name: string, hasContracts: boolean, react: boolean) => `## The web app

\`web/\` is a Next.js app (the stack Builder Hub runs on) with wagmi and RainbowKit for wallets. It is the app you built in Studio${
  react ? ', as React components' : ''
}, running against the contracts in this project${
  hasContracts ? '' : ' (none were deployed when you exported, so deploy first and export again to fill them in)'
}.

\`\`\`bash
cd web
npm install
cp .env.example .env.local   # optional: add a WalletConnect project id
npm run dev                  # http://localhost:3000
\`\`\`

### Deploy it

- **Vercel:** import this repository and set the *Root Directory* to \`web\`. Nothing else to configure.
- **Netlify or Cloudflare Pages:** set the base directory to \`web\`, build command \`npm run build\`, and use the Next.js runtime or adapter for your host.
- **Your own server:** \`cd web && npm run build && npm start\`.

### Wallets

Core, MetaMask, Rabby, Coinbase Wallet and any injected wallet work as they are. For mobile wallets through WalletConnect, create a free project at https://cloud.reown.com and set \`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID\` in \`.env.local\` and in your host's environment variables.

### What is where

${
  react
    ? `- \`frontend/\`: your React app. \`App.jsx\` is the root component; edit it and the components and styles beside it like any React project.
- \`lib/studio-react.ts\`: the \`@studio/react\` hooks your components import (\`useWallet\`, \`useRead\`, \`useWrite\`, \`useTokenBalances\`, ...). They read contracts from \`studio.config.ts\` and sign with the wallet RainbowKit connected. To use wagmi's own hooks instead, import them from \`wagmi\` in any component.
- \`components/StudioRoot.tsx\`: connects wagmi and RainbowKit to the hooks, and adds the top bar and footer.`
    : `- \`public/app/\`: your Studio frontend (\`index.html\` is split into \`lib/app-content.ts\`; \`app.js\` and the styles are served as they are). Edit \`app.js\` and \`styles.css\` here.
- \`lib/studio-runtime.ts\`: the \`window.studio\` your app code talks to, backed by wagmi.`
}
- \`lib/studio.config.ts\`: the contracts (addresses and ABIs), chains and token lists from your deployments. After you redeploy, update it, or export again.
- \`lib/wagmi.ts\`: chains and wallets.
- \`@x402/*\` in \`package.json\` are optional dependencies of the Coinbase wallet SDK that RainbowKit loads. The build fails to resolve them without the packages; you don't use them.
- Test networks only: a Studio L1's managed node expires after 3 days, so point its entry in \`studio.config.ts\` at your own RPC before sharing the site.
- \`${name}\`'s footer, "Built on Builder Hub Studio", is ${react ? 'in `components/StudioRoot.tsx`' : 'part of the page markup in `lib/app-content.ts`'}; remove it if you don't want it.
`;
