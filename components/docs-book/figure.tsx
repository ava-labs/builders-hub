import type { ReactNode } from 'react';

/**
 * A numbered docs figure: the art, then "FIGURE n" and the caption below it. figure.css counts the
 * figures of the page with a CSS counter, so the MDX gives no number. Code blocks are <figure> elements
 * too, and only data-bk-figure increments the counter. An id makes the figure a link target.
 */
export function Figure({ caption, id, children }: { caption: ReactNode; id?: string; children: ReactNode }) {
  return (
    <figure data-bk-figure="" id={id}>
      <div data-bk-figure-body="">{children}</div>
      {/* One span holds the caption, so the flex row in figure.css has two items: the number and the text. */}
      <figcaption>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
