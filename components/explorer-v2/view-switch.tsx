import { ViewTransition, type ReactNode } from "react";

/* The city and the 2D explorer are two views of one explorer, and the
   toggle between them (the city's card, the rail's first two tabs) tags
   its navigation with this type. Only that navigation fades the page:
   the view it leaves fades out fast and the one it opens fades in a little
   later (global.css, .vs-out and .vs-in). Every other link stays a cut. */
export const VIEW_SWITCH = ["view-switch"];

export function ViewSwitchFade({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={{ "view-switch": "vs-in", default: "none" }} exit={{ "view-switch": "vs-out", default: "none" }} default="none">
      {children}
    </ViewTransition>
  );
}

/* The App Router runs React's canary, which exports ViewTransition;
   @types/react 19.1 still names it unstable_ViewTransition */
type TransitionClass = string | Record<string, string>;
declare module "react" {
  export const ViewTransition: ExoticComponent<{ children?: ReactNode; name?: string; default?: TransitionClass; enter?: TransitionClass; exit?: TransitionClass; update?: TransitionClass; share?: TransitionClass }>;
}
