import type { HTMLAttributes } from 'react';

export type CalloutArtKind = 'peak' | 'slide';

/**
 * A small engraving for a callout: 'peak' (a mountain) or 'slide' (the same mountain with an avalanche). The
 * plates in public/docs-book are ink masks, black lines on a clear ground, and callout.css paints them in the
 * text color through mask-image, so one file reads on light and dark. The art is decorative, so screen
 * readers skip it.
 */
export function CalloutArt({ kind = 'peak', ...props }: { kind?: CalloutArtKind } & HTMLAttributes<HTMLSpanElement>) {
  return <span aria-hidden="true" data-bk-art={kind} {...props} />;
}
