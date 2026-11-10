import { SEA_Y } from "./Backdrop";
import type { Theme } from "./palette";

/* The air the column stands in, by the height in the world: thin from a
   tenth of the way down to the column's foot and whole by 0.72 of it. While
   the column rises out of the cloud sea (OPENING.column, warmup.tsx) a
   denser air lies over the top of the shaft, whole 600 units down, so the
   capital comes up out of it; it clears as the column lands. The mist is the
   cloud sea's own tone behind the column at the first look, so what is in it
   does not show. The column fades its marble into both (Pillar.tsx), the
   plate and all on it go with it (Ground.tsx), and so does the motto on the
   rim (Ledger.tsx). */

/** the air's color, cool as the brand's grade: a pale steel by day, a blue-black by night */
export const HAZE_COLOR: Record<Theme, string> = { light: "#E9EDF2", dark: "#121A28" };
/** the opening's mist: the cloud sea as it shows behind the rising column at camera's first look (Rig.tsx), measured by day and by night */
export const MIST_COLOR: Record<Theme, string> = { light: "#CFD3DB", dark: "#1A1C23" };

/** the column's foot: past the sea, so it is never seen */
export const FOOT = SEA_Y - 600;

/** hazeAt and mistAt (the world's height): 0 in clear air, 1 lost in it; uOpen takes OPENING.column */
export const HAZE_GLSL = /* glsl */ `
uniform float uOpen;
float hazeAt( float wy ) {
  float t = clamp( ( wy / ${FOOT.toFixed(1)} - 0.1 ) / 0.62, 0.0, 1.0 );
  return t * t * ( 3.0 - 2.0 * t );
}
float mistAt( float wy ) {
  return ( 1.0 - smoothstep( 0.9, 1.0, uOpen ) ) * smoothstep( 12.0, 600.0, -wy );
}`;
