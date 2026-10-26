'use client';

import { useState, type ComponentProps } from 'react';
import { ImageZoom, type ImageZoomProps } from 'fumadocs-ui/components/image-zoom';

/** The last zoom change: whether it opened the zoom, and whether a key press started it, so it runs at once. */
export interface ZoomChange {
  zoomed: boolean;
  instant: boolean;
}

/**
 * The change a zoom event makes. A key press runs at once: Escape closing, or Enter or Space on the zoom button
 * opening (a click a key press sends has no pointer count, `detail` 0). A pointer, a scroll or a swipe animates.
 */
export function zoomChange(zoomed: boolean, event: { type: string; detail?: number }): ZoomChange {
  return { zoomed, instant: event.type === 'keydown' || (event.type === 'click' && event.detail === 0) };
}

/**
 * The classes of a zoom's dialog (eco-blog-image-zoom in app/global.css). A change is marked on the dialog in the same
 * render that moves the image: react-medium-image-zoom sends the image back one render before it hides the backdrop,
 * so the backdrop's state cannot time the way back.
 */
export function zoomDialogClass(change: ZoomChange): string {
  return ['zoomable-image', !change.zoomed && 'zoomable-image-out', change.instant && 'zoomable-image-instant']
    .filter(Boolean)
    .join(' ');
}

type ZoomableImageProps = ComponentProps<'img'> & {
  /** MDX passes the HTML attribute; React 19 takes srcSet. */
  srcset?: string;
};

/**
 * eco-blog-image-zoom (blog posts) and X3 (docs pages): an image in the text opens full size from where it sits, and a
 * click, a scroll or Escape sends it back. fumadocs' ImageZoom (react-medium-image-zoom) grows a copy out of the
 * image's own box by transform; app/global.css sets its timing and shows the library's zoom button to the keyboard
 * (a focusable control over the image, which Enter or Space opens). The image itself renders as it did before.
 */
export function ZoomableImage({ srcset, ...props }: ZoomableImageProps) {
  const [change, setChange] = useState<ZoomChange>({ zoomed: false, instant: false });
  const rmiz: ImageZoomProps['rmiz'] = {
    // ImageZoom passes its own children to the zoom after these options
    children: undefined,
    classDialog: zoomDialogClass(change),
    onZoomChange: (zoomed, { event }) => setChange(zoomChange(zoomed, event)),
  };
  return (
    <ImageZoom src={typeof props.src === 'string' ? props.src : undefined} rmiz={rmiz}>
      {/* eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element */}
      <img {...props} {...(srcset && { srcSet: srcset })} />
    </ImageZoom>
  );
}
