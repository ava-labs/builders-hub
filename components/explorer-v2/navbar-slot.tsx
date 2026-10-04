"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* Below 640 px the site navbar's left side is empty: the logo sits in its
   middle, search and the menu button at its right. The explorer puts its
   chain switcher there, level with them, so the tab rail under the navbar
   holds only the tabs and the clock. This mounts its children in a slot at
   the navbar's left edge while the viewport is phone width, and renders
   nothing at other widths. A portal keeps them in this React tree, with its
   state and context. The slot is the navbar's first child, so the navbar's
   :last-child rules (global.css) still find the menu viewport. It is a span
   styled inline: global.css pads and widens every div under the header, and
   fumadocs sizes every child of it with classes, which inline styles beat. */
const PHONE = "(max-width: 639px)";
// the logo is centered: the slot ends before it, at half the width less the logo's half and a gap
const SLOT_STYLE =
  "position:absolute;top:0;bottom:0;left:1rem;z-index:10;display:flex;align-items:center;margin:0;padding:0;max-width:calc(50% - 2.75rem)";

export function NavbarSlot({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia(PHONE);
    let el: HTMLSpanElement | null = null;
    const sync = () => {
      const header = document.getElementById("nd-nav");
      if (media.matches && header && !el) {
        el = document.createElement("span");
        el.dataset.explorerNavbarSlot = "";
        el.style.cssText = SLOT_STYLE;
        header.prepend(el);
        setSlot(el);
      } else if (!media.matches && el) {
        el.remove();
        el = null;
        setSlot(null);
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      el?.remove();
    };
  }, []);

  return slot ? createPortal(children, slot) : null;
}
