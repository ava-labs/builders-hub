/* The 3D city's word to the app, with no three.js in the app's bundle:
   the city has stood (its towers up and lit), so what the app keeps for
   later (the closed panel's list) can come in without holding a frame of
   the opening. */

type Fn = () => void;
const subs = new Set<Fn>();
let stood = false;

/** a new city mounts: it has not stood yet */
export function cityMounting() {
  stood = false;
}

/** the city stands */
export function cityStood() {
  if (stood) return;
  stood = true;
  for (const fn of [...subs]) fn();
}

/** fn runs once the city stands, at once if it already does; the return lets go */
export function onCityStood(fn: Fn): () => void {
  if (stood) {
    fn();
    return () => {};
  }
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
