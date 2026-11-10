// One spring sits between raw scroll position and every scrubbed transform:
// near-critically damped, so reveals glide a beat behind the wheel without
// visible overshoot. Band/threshold logic must keep reading the RAW progress:
// springing a value that gates discrete state would make swaps feel late.
export const SCRUB_SPRING = { stiffness: 90, damping: 26, restDelta: 0.001 };
