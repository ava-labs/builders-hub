'use client';

import { Droplet } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useReducer, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'docs-colorkey';

/* Only the page content counts. The key under the toggle is in the TOC, and it must not count as a role. */
const ROLE_SELECTOR = '[data-route-layout="docs"] #nd-page article [data-bk-role]';

/* Storage can throw, for example in a locked-down browser. Then the key stays on and is not saved. */
function readSavedOn(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveOn(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // The choice holds for this page view only.
  }
}

/* tokens.css reads html[data-colorkey="off"] and sets every role color to the text color. */
function applyOn(on: boolean) {
  if (on) delete document.documentElement.dataset.colorkey;
  else document.documentElement.dataset.colorkey = 'off';
}

/*
 * The html attribute is the one source of the state. Two toggles can show at the same time (the TOC rail and
 * the TOC popover), and each one reads the attribute, so a click on one also changes the other.
 */
function subscribeToKey(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-colorkey'] });
  return () => observer.disconnect();
}

const readOn = () => document.documentElement.dataset.colorkey !== 'off';
const pageHasRoles = () => document.querySelector(ROLE_SELECTOR) !== null;
const subscribeToNothing = () => () => {};
const serverOn = () => true;
const serverHasRoles = () => false;

/* The saved choice goes to the html attribute once per page load, not once per toggle. */
let restored = false;

const KEY = [
  { role: 'pchain', words: 'P-Chain side' },
  { role: 'evm', words: 'EVM side' },
] as const;

/**
 * Turns the docs color key on and off, in the TOC footer under the page actions and in the TOC popover on
 * smaller screens. It shows only when the page has a color-key term or figure part ([data-bk-role]), so other
 * pages get no dead control. The server renders nothing. Under the switch, a key gives each color a shape and
 * words, so the meaning is not in the color alone. figure.css styles the switch and the key.
 */
export function ColorKeyToggle() {
  const pathname = usePathname();
  const keyId = useId();
  const on = useSyncExternalStore(subscribeToKey, readOn, serverOn);
  // A toggle that mounts after hydration (the popover opens) reads the page in its first render, so the popover
  // measures its height with the toggle in it. After a client navigation, the effect reads the new page again.
  const hasRoles = useSyncExternalStore(subscribeToNothing, pageHasRoles, serverHasRoles);
  const [, recheck] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (restored) return;
    restored = true;
    applyOn(readSavedOn());
  }, []);

  useEffect(() => recheck(), [pathname]);

  if (!hasRoles) return null;

  const toggle = () => {
    applyOn(!on);
    saveOn(!on);
  };

  // role="switch": an on and off control. It also keeps the TOC bar on phones at one button.
  return (
    <div data-bk-colorkey="">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        role="switch"
        aria-checked={on}
        aria-describedby={keyId}
        onClick={toggle}
      >
        <Droplet className="size-4" />
        Color key
        {/* aria-checked gives the state to screen readers, so the word is for sighted users only. */}
        <span aria-hidden="true" data-bk-colorkey-state="" className="ml-auto">
          {on ? 'On' : 'Off'}
        </span>
      </Button>
      <ul id={keyId} data-bk-colorkey-list="" hidden={!on}>
        {KEY.map(({ role, words }) => (
          <li key={role}>
            <span aria-hidden="true" data-bk-colorkey-swatch={role} />
            {words}
          </li>
        ))}
      </ul>
    </div>
  );
}
