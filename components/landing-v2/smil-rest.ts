/* ------------------------------------------------------------------ */
/* sol-diagrams-rest: SMIL drawings at rest                             */
/*                                                                      */
/* The use-case, privacy and photo-overlay drawings loop with SMIL,     */
/* which ignores prefers-reduced-motion (the site's CSS reducer cannot  */
/* reach it) and runs whether a drawing is on screen or not. Used as a  */
/* callback ref on an <svg> (React runs the returned cleanup when it    */
/* unmounts): under Reduce Motion the drawing holds on the frame at     */
/* SMIL_STILL, a token mid-route, so the still still tells the story;   */
/* otherwise it pauses while off screen and plays on from where it      */
/* stopped.                                                             */
/* ------------------------------------------------------------------ */

/** The frame, in seconds, a drawing holds on under Reduce Motion. */
export const SMIL_STILL = 1.4;

export function restSmil(svg: SVGSVGElement | null): (() => void) | undefined {
  if (!svg || typeof IntersectionObserver === "undefined" || typeof matchMedia !== "function") return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let onScreen = true;
  const apply = () => {
    if (reduce.matches) {
      svg.setCurrentTime(SMIL_STILL);
      svg.pauseAnimations();
    } else if (onScreen) {
      svg.unpauseAnimations();
    } else {
      svg.pauseAnimations();
    }
  };
  const observer = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    apply();
  });
  observer.observe(svg);
  reduce.addEventListener("change", apply);
  apply();
  return () => {
    observer.disconnect();
    reduce.removeEventListener("change", apply);
    svg.unpauseAnimations();
  };
}
