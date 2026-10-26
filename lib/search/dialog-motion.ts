// site-search-dialog: whether the docs search dialog (components/search.tsx)
// shows and leaves at once. Opened from the keyboard (Cmd K, or Enter on the
// focused search field) it does; opened with a pointer it settles in and
// leaves with its short exit (app/global.css). The input that opened the
// dialog decides both ways: it is read as the dialog opens and kept while it
// closes, so a key pressed while a click-opened dialog leaves cannot cut its
// exit short.

export type SearchInput = 'keyboard' | 'pointer';

export interface SearchMotionState {
  /** the kind of the last key or pointer press on the page */
  last: SearchInput;
  /** whether the dialog is open */
  open: boolean;
  /** whether the dialog shows and leaves at once: it was opened from the keyboard */
  instant: boolean;
}

export type SearchMotionEvent = { type: 'input'; input: SearchInput } | { type: 'open'; open: boolean };

export const SEARCH_MOTION_START: SearchMotionState = { last: 'pointer', open: false, instant: false };

/** The state after `event`; the same state when nothing changes, so React can skip the render. */
export function searchMotion(state: SearchMotionState, event: SearchMotionEvent): SearchMotionState {
  if (event.type === 'input') return state.last === event.input ? state : { ...state, last: event.input };
  if (event.open === state.open) return state;
  // opening reads the last input; closing keeps what the opening decided
  return event.open ? { ...state, open: true, instant: state.last === 'keyboard' } : { ...state, open: false };
}
