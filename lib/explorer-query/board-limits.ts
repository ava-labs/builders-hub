/* A board's size limits, read by the board routes' checks (board-wire.ts)
   and by the page's own Playground import (playground.ts). Its own file, so
   the page does not load board-wire's schemas, which bring the designer's
   grammar (visual.ts) and the AI SDK with it. */

/** the tiles one board holds */
export const MAX_TILES = 40;
