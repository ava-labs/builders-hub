/* The trace reads like highlighted code: one hue per kind of thing, the
   same in every tab, light and dark. Contract names stay ink; the brand
   red is kept for reverts. The trace (EvmTrace.tsx) and its Gas tab
   (EvmTraceGas.tsx) share these. */
export const TRACE_INK = {
  fn: "text-violet-700 dark:text-violet-300",
  addr: "text-teal-700 dark:text-teal-300",
  num: "text-amber-700 dark:text-amber-300",
  yes: "text-emerald-700 dark:text-emerald-300",
  no: "text-red-700 dark:text-red-300",
  bytes: "text-zinc-500 dark:text-zinc-400",
  str: "text-sky-700 dark:text-sky-300",
  punct: "text-zinc-300 dark:text-zinc-700",
  param: "text-zinc-400 dark:text-zinc-500",
  type: {
    CALL: "text-zinc-500 dark:text-zinc-400",
    STATICCALL: "text-sky-600 dark:text-sky-400",
    DELEGATECALL: "text-fuchsia-600 dark:text-fuchsia-400",
    CALLCODE: "text-fuchsia-600 dark:text-fuchsia-400",
    CREATE: "text-emerald-600 dark:text-emerald-400",
    CREATE2: "text-emerald-600 dark:text-emerald-400",
    SELFDESTRUCT: "text-red-600 dark:text-red-400",
  } as Record<string, string>,
};
