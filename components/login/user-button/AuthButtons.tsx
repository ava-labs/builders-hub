'use client';

// v2 design language: the signed-out pair at the 2rem height of the search
// field and theme toggle, in the nav links' 14px medium type. Log in is a
// quiet ghost; Sign up is a solid ink block that carries the hero CTAs' red
// edge bar, so its left padding adds the bar's 2px to center the label. The
// padding takes `!` because the unlayered `nav button` rule in
// app/global.css outranks Tailwind's layered utilities. In forced colors
// the fill and the inset bar drop out, so a border keeps Sign up a button.
const BUTTON_CLASS =
  'inline-flex h-8 items-center justify-center whitespace-nowrap text-sm font-medium leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6212F]';
const LOG_IN_CLASS = `${BUTTON_CLASS} px-3! text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white dark:active:bg-zinc-800`;
const SIGN_UP_CLASS = `${BUTTON_CLASS} pr-3! pl-3.5! forced-colors:border bg-zinc-900 text-white shadow-[inset_2px_0_0_#E6212F] hover:bg-zinc-800 active:bg-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:active:bg-white`;

export function AuthButtons({ onLogIn, onSignUp }: { onLogIn: () => void; onSignUp: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onLogIn} className={LOG_IN_CLASS}>
        Log in
      </button>
      <button type="button" onClick={onSignUp} className={SIGN_UP_CLASS}>
        Sign up
      </button>
    </div>
  );
}
