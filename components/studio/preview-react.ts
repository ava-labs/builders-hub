import { bootstrap, buildPreviewDocument, withBuiltFooter, type PreviewContext } from './preview';

/*
 * React apps. A Studio frontend is `frontend/App.jsx` (a component, default export) plus any components it imports.
 * The builder's browser compiles the JSX, and the sandboxed frame runs it with a small module loader: no bundler,
 * no blob URLs or import maps (a sandboxed frame can use neither reliably). React, viem and the `@studio/react` hooks
 * are the only packages; the exported Next.js app uses the same files with real npm packages.
 */

export const REACT_ENTRY = 'frontend/App.jsx';
export const STUDIO_REACT = '@studio/react';

const REACT_VERSION = '19.2.4';
const VIEM_VERSION = '2.45.3';

/** Where a package comes from in the preview, or null when the preview doesn't offer it. */
export function externalUrl(spec: string): string | null {
  const react = `https://esm.sh/react@${REACT_VERSION}`;
  const dom = `https://esm.sh/react-dom@${REACT_VERSION}`;
  const deps = `?deps=react@${REACT_VERSION}`;
  if (spec === 'react') return react;
  if (spec === 'react/jsx-runtime' || spec === 'react/jsx-dev-runtime') return `${react}/jsx-runtime`;
  if (spec === 'react-dom') return `${dom}${deps}`;
  if (spec === 'react-dom/client') return `${dom}/client${deps}`;
  if (spec === 'viem') return `https://esm.sh/viem@${VIEM_VERSION}`;
  if (/^viem\/[a-z0-9/-]+$/.test(spec)) return `https://esm.sh/viem@${VIEM_VERSION}/${spec.slice('viem/'.length)}`;
  return null;
}

export const hasReactApp = (files: { path: string }[]) => files.some((f) => f.path === REACT_ENTRY);

const jsonForScript = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/** The script that runs inside the frame: loads the packages, evaluates the compiled modules, renders <App />. */
const LOADER = `
(async () => {
  const { MODULES, EXTERNALS, UNSUPPORTED, ENTRY } = window.__studioApp;
  const root = document.getElementById('root');
  const report = (message) => window.parent.postMessage({ channel: window.__studioChannel, type: 'error', message: String(message).slice(0, 2000) }, '*');
  const show = (message) => {
    report(message);
    const box = document.createElement('pre');
    box.className = 'bh-notice bh-notice--bad';
    box.style.cssText = 'white-space:pre-wrap;margin:16px;font-family:var(--bh-font-mono,monospace);font-size:12px';
    box.textContent = message;
    root.replaceChildren(box);
  };
  try {
    if (UNSUPPORTED.length) {
      throw new Error("The preview can't load " + UNSUPPORTED.map((s) => "'" + s + "'").join(', ') + '. An app can import react, react-dom/client, viem, @studio/react and its own files.');
    }
    const ext = {};
    await Promise.all(Object.entries(EXTERNALS).map(async ([spec, url]) => { ext[spec] = await import(url); }));
    const cache = {};
    const dirname = (key) => key.split('/').slice(0, -1);
    const resolve = (from, spec) => {
      const parts = dirname(from);
      for (const segment of spec.split('/')) {
        if (segment === '' || segment === '.') continue;
        if (segment === '..') parts.pop(); else parts.push(segment);
      }
      const base = parts.join('/');
      return [base, base + '.jsx', base + '.js', base + '/index.jsx', base + '/index.js'].find((k) => k in MODULES);
    };
    const load = (key) => {
      if (cache[key]) return cache[key].exports;
      const module = { exports: {} };
      cache[key] = module;
      new Function('require', 'module', 'exports', MODULES[key])((spec) => req(key, spec), module, module.exports);
      return module.exports;
    };
    const req = (from, spec) => {
      if (/\\.css$/.test(spec)) return {};
      if (spec === '${STUDIO_REACT}') return load('${STUDIO_REACT}');
      if (spec[0] === '.') {
        const key = resolve(from, spec);
        if (!key) throw new Error("Can't find '" + spec + "' imported from " + from + ". Use the full file name, for example './components/Card.jsx'.");
        return load(key);
      }
      if (spec in ext) return ext[spec];
      throw new Error("'" + spec + "' isn't available in the preview.");
    };
    const React = ext['react'];
    class Boundary extends React.Component {
      constructor(props) { super(props); this.state = { error: null }; }
      static getDerivedStateFromError(error) { return { error }; }
      componentDidCatch(error) { report((error && error.message) || error); }
      render() {
        if (!this.state.error) return this.props.children;
        return React.createElement('pre', { className: 'bh-notice bh-notice--bad', style: { whiteSpace: 'pre-wrap', margin: 16, fontFamily: 'var(--bh-font-mono, monospace)', fontSize: 12 } }, 'This page hit an error: ' + (this.state.error.message || this.state.error));
      }
    }
    const entry = load(ENTRY);
    const App = entry.default || entry.App;
    if (!App) throw new Error('frontend/App.jsx must export a component: export default function App() { ... }');
    ext['react-dom/client'].createRoot(root).render(React.createElement(Boundary, null, React.createElement(App)));
  } catch (error) {
    show((error && error.message) || error);
  }
})();
`;

/** Every bare package a compiled module asks for. */
function requiredPackages(code: string): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(/require\((["'])([^"']+)\1\)/g)) {
    const spec = match[2];
    if (!spec.startsWith('.') && spec !== STUDIO_REACT) found.add(spec);
  }
  return [...found];
}

/** The page for a React app: its compiled modules, the design system and the footer, run by the loader. */
export async function buildReactDocument(
  context: PreviewContext,
  channel: string,
  theme: 'light' | 'dark' = 'light',
): Promise<string> {
  const { transform } = await import('sucrase');
  const modules: Record<string, string> = {};
  const compileErrors: string[] = [];

  for (const file of context.files) {
    if (!/^frontend\/.+\.(jsx|js)$/.test(file.path)) continue;
    try {
      modules[file.path.slice('frontend/'.length)] = transform(file.content, {
        transforms: ['jsx', 'imports'],
        jsxRuntime: 'automatic',
        production: true,
        filePath: file.path,
      }).code;
    } catch (error) {
      compileErrors.push(`${file.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (context.studioReact) {
    modules[STUDIO_REACT] = transform(context.studioReact, {
      transforms: ['typescript', 'imports'],
      production: true,
      filePath: 'studio-react.ts',
    }).code;
  }

  const externals: Record<string, string> = {};
  const unsupported: string[] = [];
  // The loader itself needs these, whatever the app imports.
  for (const spec of ['react', 'react-dom/client', 'react/jsx-runtime', 'viem']) externals[spec] = externalUrl(spec)!;
  for (const code of Object.values(modules)) {
    for (const spec of requiredPackages(code)) {
      const url = externalUrl(spec);
      if (url) externals[spec] = url;
      else if (!unsupported.includes(spec)) unsupported.push(spec);
    }
  }

  const styleFiles = context.files.filter((f) => /^frontend\/.+\.css$/.test(f.path));
  const ownDesign = styleFiles.some((f) => f.path === 'frontend/builder-hub.css');
  const css = [
    ...(!ownDesign && context.designCss ? [context.designCss] : []),
    ...styleFiles
      .sort((a, b) =>
        a.path === 'frontend/builder-hub.css'
          ? -1
          : b.path === 'frontend/builder-hub.css'
            ? 1
            : a.path.localeCompare(b.path),
      )
      .map((f) => f.content),
  ]
    .map((sheet) => `<style>${sheet.replace(/<\/style/gi, '<\\/style')}</style>`)
    .join('\n');

  const app = {
    MODULES: modules,
    EXTERNALS: externals,
    UNSUPPORTED: unsupported,
    ENTRY: 'App.jsx',
  };
  const loaderData = `window.__studioChannel = ${jsonForScript(channel)}; window.__studioApp = ${jsonForScript(app)};`;

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${bootstrap(context, channel, theme)}
${css}
</head>
<body>
<div id="root"></div>
${compileErrors.length ? `<script>window.parent.postMessage({ channel: ${jsonForScript(channel)}, type: 'error', message: ${jsonForScript(compileErrors.join('\n'))} }, '*');</script>` : ''}
<script>${loaderData}</script>
<script>${LOADER.replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>`;
  return withBuiltFooter(page);
}

/** The page for whatever the project built: a React app, or a plain HTML page from before React became the default. */
export async function buildAppDocument(
  context: PreviewContext,
  channel: string,
  theme: 'light' | 'dark' = 'light',
): Promise<string | null> {
  if (hasReactApp(context.files)) return buildReactDocument(context, channel, theme);
  return buildPreviewDocument(context, channel, theme);
}
