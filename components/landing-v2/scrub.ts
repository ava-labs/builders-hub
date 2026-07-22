// One spring sits between raw scroll position and every scrubbed transform:
// near-critically damped, so reveals glide a beat behind the wheel without
// visible overshoot. Band/threshold logic must keep reading the RAW progress
// — springing a value that gates discrete state would make swaps feel late.
export const SCRUB_SPRING = { stiffness: 90, damping: 26, restDelta: 0.001 };

// One cadence for every auto-rotating stage AND its visible progress fill —
// if these drift apart the fill lies about when the stage will turn.
// 9s: long enough to read a panel's headline, tagline, and one full loop of
// its diagram's choreography before the stage turns.
export const ROTATE_MS = 9000;
