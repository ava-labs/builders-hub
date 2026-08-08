/**
 * Audits motion constants: CSS-only, built on tailwindcss-animate utilities
 * and plain transitions. The site-wide prefers-reduced-motion reducer in
 * app/global.css flattens every one of these, so components need no extra
 * motion-safe guards. Durations 120-300ms; entrances may use the house ease.
 */
export const EASE_HOUSE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

export const STEP_ENTER_FWD = "animate-in fade-in slide-in-from-right-2 duration-200";
export const STEP_ENTER_BACK = "animate-in fade-in slide-in-from-left-2 duration-200";

export const ROW_ENTER = "animate-in fade-in slide-in-from-top-1 duration-300";

export const CHECK_POP = "animate-in zoom-in-75 duration-200";
export const CHIP_POP = "animate-in zoom-in-50 duration-150";

export const HOVER_LIFT = "transition-all duration-150 hover:-translate-y-px hover:shadow-sm";
export const CHEVRON_NUDGE = "transition-transform duration-150 group-hover:translate-x-0.5";

export const CONNECTOR_FILL = `origin-left transition-transform duration-200 ${EASE_HOUSE}`;
export const WIDTH_TWEEN = `transition-[width] duration-300 ${EASE_HOUSE}`;
