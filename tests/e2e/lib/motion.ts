import type { Browser } from '@e2e-dev/web';

// Helpers for the motion tests. The engine cannot emulate prefers-reduced-motion or prefers-color-scheme, and it has
// no console events (node_modules/e2e/docs/viewports.mdx, docs/migrate/playwright.mdx), so these work through init
// scripts, the public test API. Add an init script with browser.addInitScript before app.open.

/**
 * Init script: the page runs as if the OS asked for reduced motion. matchMedia answers the reduced-motion queries as
 * "reduce" (framer-motion and the components' own checks read it), and every CSS media rule that names the feature is
 * rewritten so "reduce" always applies and "no-preference" never does (Tailwind's motion-safe: and motion-reduce:
 * included). A stylesheet is rewritten when it loads and whenever the DOM changes.
 */
export function reducedMotion(): void {
  const REDUCE = /\(\s*prefers-reduced-motion\s*(?::\s*reduce\s*)?\)/g;
  const NO_PREFERENCE = /\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)/g;
  const rewrite = (text: string) => text.replace(NO_PREFERENCE, '(max-width: 0px)').replace(REDUCE, '(min-width: 0px)');
  const original = window.matchMedia.bind(window);
  window.matchMedia = (query: string) => {
    const list = original(rewrite(query));
    return new Proxy(list, {
      get(target, key) {
        if (key === 'media') return query;
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        const next = rewrite(rule.media.mediaText);
        if (next !== rule.media.mediaText) rule.media.mediaText = next;
      }
      if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
    }
  };
  const sweep = () => {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        // a cross-origin sheet has no readable rules
      }
    }
  };
  new MutationObserver(sweep).observe(document, { subtree: true, childList: true, characterData: true });
  document.addEventListener('load', sweep, true);
  document.addEventListener('DOMContentLoaded', sweep);
}

/**
 * Init script: keeps every console.error and console.warn of the page, and uncaught errors, in window.__e2eConsole.
 * Read them with consoleMessages. React logs a hydration mismatch with console.error.
 */
export function captureConsole(): void {
  const store: string[] = [];
  (window as unknown as { __e2eConsole: string[] }).__e2eConsole = store;
  const keep = (kind: string, args: unknown[]) =>
    store.push(
      `${kind}: ${args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ')}`.slice(0, 400),
    );
  const error = console.error.bind(console);
  const warn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    keep('error', args);
    error(...args);
  };
  console.warn = (...args: unknown[]) => {
    keep('warn', args);
    warn(...args);
  };
  window.addEventListener('error', (event) => keep('uncaught', [event.message]));
}

/** The messages captureConsole kept so far. */
export function consoleMessages(browser: Browser): Promise<string[]> {
  return browser.evaluate(() => [...((window as unknown as { __e2eConsole?: string[] }).__e2eConsole ?? [])]);
}

/** The messages that report a hydration mismatch (React's dev and production wording). */
export function hydrationMessages(messages: readonly string[]): string[] {
  return messages.filter((message) => /hydrat|did not match|#418|#423|#425/i.test(message));
}

/**
 * The running animations of the page that move something: a CSS animation or a script animation whose keyframes
 * change transform, translate, scale or rotate, and a CSS transition of one of those properties. Each is described as
 * "<kind> <name or property> on <element>".
 */
export function movingAnimations(browser: Browser): Promise<string[]> {
  return browser.evaluate(() => {
    const MOVES = /^(transform|translate|scale|rotate)$/;
    const describe = (node: Element | null) =>
      node ? `${node.tagName.toLowerCase()}.${String(node.getAttribute('class') ?? '').slice(0, 60)}` : 'unknown';
    return document
      .getAnimations()
      .filter((animation) => animation.playState === 'running')
      .flatMap((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        const target = describe(effect?.target ?? null);
        if (animation instanceof CSSTransition) {
          return MOVES.test(animation.transitionProperty)
            ? [`transition ${animation.transitionProperty} on ${target}`]
            : [];
        }
        const properties = new Set((effect?.getKeyframes() ?? []).flatMap((frame) => Object.keys(frame)));
        const moved = [...properties].filter((property) => MOVES.test(property));
        if (moved.length === 0) return [];
        const name = animation instanceof CSSAnimation ? animation.animationName : animation.id || 'script';
        return [`animation ${name} (${moved.join(', ')}) on ${target}`];
      });
  });
}

/**
 * Init script for the theme: next-themes reads the visitor's pick from localStorage "theme" before the first paint.
 * Pass "light" or "dark" as the argument.
 */
export function pickTheme(theme: string): void {
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // storage blocked: the page keeps the system theme
  }
}
